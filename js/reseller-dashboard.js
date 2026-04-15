/* Reseller dashboard — Stripe Connect (API /api/resellers/*). */

const API_BASE_URL = window.getApiBaseUrl();

async function parseApiError(response) {
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
    }
    return data.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function fetchAuth(url, options = {}) {
  return window.juniorFetchWithAuth(url, {
    ...options,
    auth401Redirect: 'portal.html',
  });
}

function showEl(id, show = true) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
}

function setLoading(loading) {
  showEl('reseller-loading', loading);
  showEl('reseller-main', !loading);
}

function buildOnboardingSupportMessage(message) {
  const details = message || 'Something went wrong while starting onboarding.';
  return `${details} If this keeps happening, contact support@heyjunior.ai and include "reseller onboarding".`;
}

async function fetchOnboardingUrl() {
  const startRes = await fetchAuth(`${API_BASE_URL}/api/resellers/onboard`, {
    method: 'POST',
  });

  if (startRes.status === 429) {
    throw new Error('Too many requests. Please wait a minute and try again.');
  }

  if (startRes.ok) {
    const data = await startRes.json();
    if (data.onboarding_url) return data.onboarding_url;
    throw new Error('Onboarding link was not returned. Please try again.');
  }

  const startErr = await parseApiError(startRes);
  const shouldTryRefresh =
    startRes.status >= 500 || /set up reseller account/i.test(startErr) || /already onboarded/i.test(startErr);

  if (!shouldTryRefresh) {
    throw new Error(startErr);
  }

  const refreshRes = await fetchAuth(`${API_BASE_URL}/api/resellers/onboard/refresh`);
  if (refreshRes.status === 429) {
    throw new Error('Too many requests. Please wait a minute and try again.');
  }
  if (refreshRes.ok) {
    const refreshData = await refreshRes.json();
    if (refreshData.onboarding_url) return refreshData.onboarding_url;
  }

  const refreshErr = await parseApiError(refreshRes);
  throw new Error(`${startErr} (refresh failed: ${refreshErr})`);
}

async function redirectToOnboarding() {
  const onboardingUrl = await fetchOnboardingUrl();
  window.location.href = onboardingUrl;
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
  if (!token) {
    window.location.href = 'portal.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const onboarding = params.get('onboarding');

  try {
    if (onboarding === 'complete') {
      const res = await fetchAuth(`${API_BASE_URL}/api/resellers/onboard/return`);
      const wrap = document.getElementById('onboarding-result');
      if (wrap) {
        wrap.style.display = 'block';
        if (res.ok) {
          const data = await res.json();
          wrap.innerHTML = `<p class="reseller-note reseller-note-success"><strong>Stripe status updated.</strong> Status: <code>${escapeHtml(
            String(data.status || '')
          )}</code>. Charges: ${data.charges_enabled ? 'yes' : 'no'} · Payouts: ${data.payouts_enabled ? 'yes' : 'no'}</p>`;
        } else {
          wrap.innerHTML = `<p class="reseller-note reseller-note-error">${escapeHtml(await parseApiError(res))}</p>`;
        }
      }
      window.history.replaceState({}, '', 'reseller-dashboard.html');
    } else if (onboarding === 'refresh') {
      const res = await fetchAuth(`${API_BASE_URL}/api/resellers/onboard/refresh`);
      if (res.ok) {
        const data = await res.json();
        if (data.onboarding_url) {
          window.location.href = data.onboarding_url;
          return;
        }
      }
      const wrap = document.getElementById('onboarding-result');
      if (wrap) {
        wrap.style.display = 'block';
        wrap.innerHTML = `<p class="reseller-note reseller-note-error">${escapeHtml(await parseApiError(res))}</p>`;
      }
      window.history.replaceState({}, '', 'reseller-dashboard.html');
    }
  } catch (e) {
    console.error(e);
    const wrap = document.getElementById('onboarding-result');
    if (wrap) {
      wrap.style.display = 'block';
      wrap.innerHTML = `<p class="reseller-note reseller-note-error">${escapeHtml(e.message || 'Something went wrong')}</p>`;
    }
    window.history.replaceState({}, '', 'reseller-dashboard.html');
  }

  await loadResellerView();
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadResellerView() {
  const sectionIds = [
    'reseller-error',
    'reseller-not-eligible',
    'reseller-suspended',
    'reseller-pending',
    'reseller-onboarding-panel',
    'reseller-active',
  ];
  sectionIds.forEach((id) => showEl(id, false));

  let me;
  try {
    const res = await fetchAuth(`${API_BASE_URL}/api/users/me`);
    if (!res.ok) {
      throw new Error(await parseApiError(res));
    }
    me = await res.json();
  } catch (e) {
    document.getElementById('reseller-error-text').textContent = e.message || 'Failed to load profile';
    showEl('reseller-error', true);
    setLoading(false);
    return;
  }

  if (!me.is_reseller) {
    showEl('reseller-not-eligible', true);
    wireSelfEnrollButton();
    setLoading(false);
    return;
  }

  const status = me.reseller_status;
  if (status === 'suspended') {
    showEl('reseller-suspended', true);
    setLoading(false);
    return;
  }
  if (status === 'pending') {
    showEl('reseller-pending', true);
    setLoading(false);
    return;
  }
  if (status === 'active') {
    await loadActiveDashboard();
    setLoading(false);
    return;
  }

  // Any other status (pending, approved, onboarding, null) → show Stripe setup
  showEl('reseller-onboarding-panel', true);
  wireOnboardingButtons();
  setLoading(false);
}

function wireSelfEnrollButton() {
  const btn = document.getElementById('btn-self-enroll');
  const errorEl = document.getElementById('self-enroll-error');
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Setting up your account…';
    if (errorEl) errorEl.style.display = 'none';
    try {
      await redirectToOnboarding();
    } catch (e) {
      if (errorEl) {
        const msg = buildOnboardingSupportMessage(e.message);
        errorEl.innerHTML = `<strong>Setup failed:</strong> ${escapeHtml(msg)}`;
        errorEl.style.display = 'block';
      }
      btn.disabled = false;
      btn.textContent = 'Get Started — Set Up Payouts';
    }
  };
}

function wireOnboardingButtons() {
  const connect = document.getElementById('btn-connect-stripe');
  if (connect) {
    connect.onclick = async () => {
      connect.disabled = true;
      try {
        await redirectToOnboarding();
      } catch (e) {
        const msg = buildOnboardingSupportMessage(e.message || 'Could not start onboarding');
        const wrap = document.getElementById('onboarding-result');
        if (wrap) {
          wrap.style.display = 'block';
          wrap.innerHTML = `<p class="reseller-note reseller-note-error"><strong>Onboarding failed:</strong> ${escapeHtml(msg)}</p>`;
        } else {
          alert(msg);
        }
      } finally {
        connect.disabled = false;
      }
    };
  }
}

async function loadActiveDashboard() {
  showEl('reseller-active', true);

  const [dashRes, refRes] = await Promise.all([
    fetchAuth(`${API_BASE_URL}/api/resellers/dashboard`),
    fetchAuth(`${API_BASE_URL}/api/resellers/referrals`),
  ]);

  if (!dashRes.ok) {
    document.getElementById('dashboard-stats').innerHTML = `<p class="reseller-note reseller-note-error">${escapeHtml(
      await parseApiError(dashRes)
    )}</p>`;
  } else {
    const d = await dashRes.json();
    const fmt = (cents) => '$' + (Number(cents || 0) / 100).toFixed(2);
    const code = d.referral_code || '';
    const shareLink = code ? `${window.location.origin}/?ref=${encodeURIComponent(code)}` : '';

    document.getElementById('dashboard-stats').innerHTML = `
      <div class="referral-link-section reseller-ref-first">
        <label for="reseller-referral-link-input">Your Referral Link</label>
        <div class="referral-link-container">
          <input type="text" id="reseller-referral-link-input" readonly value="${escapeHtml(shareLink || '—')}" placeholder="No referral code yet">
          <button type="button" class="copy-button" id="reseller-copy-ref-btn" title="Copy referral link" ${shareLink ? '' : 'disabled'}>
            <span id="reseller-copy-btn-text">Copy</span>
          </button>
        </div>
      </div>
      <div class="reseller-stat-grid">
        <div class="reseller-stat"><span class="reseller-stat-label">Total earned</span><span class="reseller-stat-value">${fmt(
          d.total_earned_cents
        )}</span></div>
        <div class="reseller-stat"><span class="reseller-stat-label">This month</span><span class="reseller-stat-value">${fmt(
          d.current_month_cents
        )}</span></div>
        <div class="reseller-stat"><span class="reseller-stat-label">Active referrals</span><span class="reseller-stat-value">${Number(
          d.active_referrals || 0
        )}</span></div>
        <div class="reseller-stat"><span class="reseller-stat-label">Total referrals</span><span class="reseller-stat-value">${Number(
          d.total_referrals || 0
        )}</span></div>
      </div>
    `;

    const copyBtn = document.getElementById('reseller-copy-ref-btn');
    const copyBtnText = document.getElementById('reseller-copy-btn-text');
    const linkInput = document.getElementById('reseller-referral-link-input');
    if (copyBtn && shareLink) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(shareLink);
          if (linkInput) {
            linkInput.select();
            linkInput.setSelectionRange(0, 99999);
          }
          copyBtn.classList.add('copied');
          if (copyBtnText) copyBtnText.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            if (copyBtnText) copyBtnText.textContent = 'Copy';
          }, 2000);
        } catch (err) {
          if (linkInput) {
            linkInput.select();
            linkInput.setSelectionRange(0, 99999);
          }
          try {
            document.execCommand('copy');
          } catch (e2) {
            prompt('Copy this link:', shareLink);
          }
        }
      });
    }
  }

  const tbody = document.querySelector('#referrals-table tbody');
  if (!refRes.ok) {
    tbody.innerHTML = `<tr><td colspan="3">${escapeHtml(await parseApiError(refRes))}</td></tr>`;
  } else {
    const data = await refRes.json();
    const rows = data.referrals || [];
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">No referrals yet.</td></tr>';
    } else {
      tbody.innerHTML = rows
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.email || '—')}</td><td>${escapeHtml(
              r.signed_up ? new Date(r.signed_up).toLocaleString() : '—'
            )}</td><td>${r.is_active ? 'Active' : 'Inactive'}</td></tr>`
        )
        .join('');
    }
  }

  const stripeBtn = document.getElementById('btn-stripe-express');
  if (stripeBtn) {
    stripeBtn.onclick = async () => {
      stripeBtn.disabled = true;
      try {
        const res = await fetchAuth(`${API_BASE_URL}/api/resellers/stripe-login`);
        if (res.status === 429) {
          throw new Error('Too many requests. Please wait a minute and try again.');
        }
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = await res.json();
        if (data.login_url) window.open(data.login_url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        alert(e.message || 'Could not open Stripe');
      } finally {
        stripeBtn.disabled = false;
      }
    };
  }
}
