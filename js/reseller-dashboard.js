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
  const details = message || 'Something went wrong while opening Stripe.';
  return `${details} If this keeps happening, contact support@heyjunior.ai and include "reseller Stripe".`;
}

/**
 * Hosted AccountLink: prefer GET refresh when a Connect account already exists;
 * otherwise POST onboard. Handles POST 400 "already onboarded" with a refresh fallback.
 */
async function fetchStripeAccountLink(me) {
  if (me?.stripe_connect_account_id) {
    const refreshRes = await fetchAuth(`${API_BASE_URL}/api/resellers/onboard/refresh`);
    if (refreshRes.status === 429) {
      throw new Error('Too many requests. Please wait a minute and try again.');
    }
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      if (data.onboarding_url) return data.onboarding_url;
    }
  }

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
  const tryRefreshAfterStart =
    startRes.status >= 500 ||
    /set up reseller account/i.test(startErr) ||
    /already onboarded|already complete|link expired|account link/i.test(startErr) ||
    (startRes.status === 400 && /already|onboard|connect|stripe/i.test(startErr));

  if (tryRefreshAfterStart) {
    const refreshRes = await fetchAuth(`${API_BASE_URL}/api/resellers/onboard/refresh`);
    if (refreshRes.status === 429) {
      throw new Error('Too many requests. Please wait a minute and try again.');
    }
    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      if (refreshData.onboarding_url) return refreshData.onboarding_url;
    }
    const refreshErr = await parseApiError(refreshRes);
    throw new Error(`${startErr} (${refreshErr})`);
  }

  throw new Error(startErr);
}

async function redirectToStripeOnboarding(me) {
  const onboardingUrl = await fetchStripeAccountLink(me);
  window.location.href = onboardingUrl;
}

async function redirectToStripeRefreshOnly() {
  const refreshRes = await fetchAuth(`${API_BASE_URL}/api/resellers/onboard/refresh`);
  if (refreshRes.status === 429) {
    throw new Error('Too many requests. Please wait a minute and try again.');
  }
  if (!refreshRes.ok) {
    throw new Error(await parseApiError(refreshRes));
  }
  const data = await refreshRes.json();
  if (!data.onboarding_url) {
    throw new Error('No onboarding URL returned. Try "Continue in Stripe" or contact support.');
  }
  window.location.href = data.onboarding_url;
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
          const st = escapeHtml(String(data.status ?? '—'));
          const ch = data.charges_enabled ? 'on' : 'off';
          const py = data.payouts_enabled ? 'on' : 'off';
          const det = data.details_submitted ? 'yes' : 'no';
          const warn =
            !data.payouts_enabled || !data.charges_enabled
              ? '<p style="margin:12px 0 0 0;font-size:0.95rem">Complete any remaining steps in Stripe until <strong>charges</strong> and <strong>payouts</strong> are both enabled. Then return here—the dashboard unlocks when our system and Stripe are aligned.</p>'
              : '';
          wrap.innerHTML = `<div class="reseller-note reseller-note-success"><p style="margin:0 0 8px 0"><strong>Stripe status synced.</strong></p><p style="margin:0;font-size:0.95rem">Reseller status in our system: <code>${st}</code>. Stripe reports: charges <strong>${ch}</strong>, payouts <strong>${py}</strong>, details submitted <strong>${det}</strong>.</p>${warn}</div>`;
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

function applyOnboardingPanelCopy(me, status) {
  const heading = document.getElementById('onboarding-panel-heading');
  const lead = document.getElementById('onboarding-panel-lead');
  const detail = document.getElementById('onboarding-panel-detail');
  const newLink = document.getElementById('btn-stripe-new-link');
  if (newLink) {
    newLink.style.display = me?.stripe_connect_account_id ? 'inline-block' : 'none';
  }

  if (status === 'approved') {
    if (heading) {
      heading.textContent = me?.stripe_connect_account_id ? 'Finish Stripe setup' : 'Connect Stripe';
    }
    if (lead) {
      lead.textContent = me?.stripe_connect_account_id
        ? 'You are approved. Continue in Stripe until payouts are enabled so we can deposit commissions.'
        : 'You are approved. Start Stripe Express onboarding to add your bank account and receive payouts.';
    }
    if (detail) {
      detail.textContent =
        'Reseller status in our database: approved. Payout readiness is determined in Stripe (charges and payouts enabled); we sync that when you complete hosted onboarding.';
    }
  } else if (status === 'onboarding') {
    if (heading) heading.textContent = 'Finish payout setup';
    if (lead) {
      lead.textContent =
        'Continue in Stripe until charges and payouts are enabled. You can leave and resume anytime—use Continue in Stripe or request a new link if the old one expired.';
    }
    if (detail) detail.textContent = 'Program status: onboarding.';
  } else {
    if (heading) heading.textContent = 'Stripe payout setup';
    if (lead) {
      lead.textContent =
        'When your reseller application is approved, you will use Stripe Express here for payouts. If you are already approved, open Stripe below.';
    }
    if (detail) {
      const label = status == null || status === '' ? 'not set' : String(status);
      detail.textContent = `Program status in our system: ${label}.`;
    }
  }
}

function wireOnboardingButtons(me) {
  const connect = document.getElementById('btn-connect-stripe');
  const newLink = document.getElementById('btn-stripe-new-link');
  if (connect) {
    connect.onclick = async () => {
      connect.disabled = true;
      try {
        await redirectToStripeOnboarding(me);
      } catch (e) {
        const msg = buildOnboardingSupportMessage(e.message);
        const wrap = document.getElementById('onboarding-result');
        if (wrap) {
          wrap.style.display = 'block';
          wrap.innerHTML = `<p class="reseller-note reseller-note-error"><strong>Could not open Stripe:</strong> ${escapeHtml(msg)}</p>`;
        } else {
          alert(msg);
        }
      } finally {
        connect.disabled = false;
      }
    };
  }
  if (newLink && me?.stripe_connect_account_id) {
    newLink.onclick = async () => {
      newLink.disabled = true;
      try {
        await redirectToStripeRefreshOnly();
      } catch (e) {
        const msg = buildOnboardingSupportMessage(e.message);
        const wrap = document.getElementById('onboarding-result');
        if (wrap) {
          wrap.style.display = 'block';
          wrap.innerHTML = `<p class="reseller-note reseller-note-error"><strong>Could not refresh link:</strong> ${escapeHtml(msg)}</p>`;
        } else {
          alert(msg);
        }
      } finally {
        newLink.disabled = false;
      }
    };
  }
}

function wirePayoutSetupButtons(me) {
  const cont = document.getElementById('btn-payout-continue-stripe');
  const newLink = document.getElementById('btn-payout-new-link');
  if (newLink) {
    newLink.style.display = me?.stripe_connect_account_id ? 'inline-block' : 'none';
  }
  if (cont) {
    cont.onclick = async () => {
      cont.disabled = true;
      try {
        await redirectToStripeOnboarding(me);
      } catch (e) {
        alert(buildOnboardingSupportMessage(e.message));
      } finally {
        cont.disabled = false;
      }
    };
  }
  if (newLink && me?.stripe_connect_account_id) {
    newLink.onclick = async () => {
      newLink.disabled = true;
      try {
        await redirectToStripeRefreshOnly();
      } catch (e) {
        alert(buildOnboardingSupportMessage(e.message));
      } finally {
        newLink.disabled = false;
      }
    };
  }
}

async function loadResellerView() {
  [
    'reseller-error',
    'reseller-not-eligible',
    'reseller-suspended',
    'reseller-pending',
    'reseller-onboarding-panel',
    'reseller-payout-setup',
    'reseller-active',
  ].forEach((id) => showEl(id, false));

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
    setLoading(false);
    return;
  }

  if (me.reseller_status === 'suspended') {
    showEl('reseller-suspended', true);
    setLoading(false);
    return;
  }

  if (me.reseller_status === 'pending') {
    showEl('reseller-pending', true);
    setLoading(false);
    return;
  }

  if (me.reseller_status === 'active') {
    const dashRes = await fetchAuth(`${API_BASE_URL}/api/resellers/dashboard`);
    if (dashRes.ok) {
      showEl('reseller-active', true);
      const d = await dashRes.json();
      const refRes = await fetchAuth(`${API_BASE_URL}/api/resellers/referrals`);
      renderDashboardStats(d);
      await renderReferralsTable(refRes);
      renderMarketingAssets(d.referral_code);
      wireStripeExpressButton(me);
      setLoading(false);
      return;
    }
    if (dashRes.status === 403) {
      showEl('reseller-payout-setup', true);
      wirePayoutSetupButtons(me);
      setLoading(false);
      return;
    }
    document.getElementById('reseller-error-text').textContent = await parseApiError(dashRes);
    showEl('reseller-error', true);
    setLoading(false);
    return;
  }

  const status = me.reseller_status;
  showEl('reseller-onboarding-panel', true);
  applyOnboardingPanelCopy(me, status);
  wireOnboardingButtons(me);
  setLoading(false);
}

function renderDashboardStats(d) {
  const fmt = (cents) => '$' + (Number(cents || 0) / 100).toFixed(2);
  const code = d.referral_code || '';
  const shareLink = code ? `${window.location.origin}/?ref=${encodeURIComponent(code)}` : '';

  document.getElementById('dashboard-stats').innerHTML = `
      <div class="referral-link-section reseller-ref-first">
        <label for="reseller-referral-link-input">Your reseller link</label>
        <div class="referral-link-container">
          <input type="text" id="reseller-referral-link-input" readonly value="${escapeHtml(shareLink || '—')}" placeholder="No referral code yet">
          <button type="button" class="copy-button" id="reseller-copy-ref-btn" title="Copy link" ${shareLink ? '' : 'disabled'}>
            <span id="reseller-copy-btn-text">Copy</span>
          </button>
        </div>
      </div>
      <div class="reseller-stat-grid">
        <div class="reseller-stat"><span class="reseller-stat-label">Total earned</span><span class="reseller-stat-value">${fmt(d.total_earned_cents)}</span></div>
        <div class="reseller-stat"><span class="reseller-stat-label">This month</span><span class="reseller-stat-value">${fmt(d.current_month_cents)}</span></div>
        <div class="reseller-stat"><span class="reseller-stat-label">Active referrals</span><span class="reseller-stat-value">${Number(d.active_referrals || 0)}</span></div>
        <div class="reseller-stat"><span class="reseller-stat-label">Total referrals</span><span class="reseller-stat-value">${Number(d.total_referrals || 0)}</span></div>
      </div>
      <p style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.9rem; line-height: 1.55;">
        Amounts are from your commission ledger (subscription revenue share), in <strong>USD</strong> cents converted above.
        <strong>Active / total referrals</strong> count users attributed to your reseller code when they signed up under the rules our server applies—not link clicks or anonymous traffic.
      </p>
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

async function renderReferralsTable(refRes) {
  const tbody = document.querySelector('#referrals-table tbody');
  if (!tbody) return;
  if (!refRes.ok) {
    tbody.innerHTML = `<tr><td colspan="3">${escapeHtml(await parseApiError(refRes))}</td></tr>`;
    return;
  }
  const data = await refRes.json();
  const rows = data.referrals || [];
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">No reseller-attributed signups yet.</td></tr>';
  } else {
    tbody.innerHTML = rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.email || '—')}</td><td>${escapeHtml(
            r.signed_up ? new Date(r.signed_up).toLocaleString() : '—'
          )}</td><td>${r.is_active ? 'Yes' : 'No'}</td></tr>`
      )
      .join('');
  }
}

function wireStripeExpressButton(me) {
  const stripeBtn = document.getElementById('btn-stripe-express');
  if (!stripeBtn) return;
  stripeBtn.onclick = async () => {
    stripeBtn.disabled = true;
    try {
      const res = await fetchAuth(`${API_BASE_URL}/api/resellers/stripe-login`);
      if (res.status === 429) {
        throw new Error('Too many requests. Please wait a minute and try again.');
      }
      if (res.ok) {
        const data = await res.json();
        if (data.login_url) window.open(data.login_url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (res.status === 400) {
        const link = await fetchStripeAccountLink(me || {});
        if (link) { window.location.href = link; return; }
        throw new Error('Could not start Stripe setup. Please try again.');
      }
      if (res.status === 403) {
        const meRes = await fetchAuth(`${API_BASE_URL}/api/users/me`);
        const fresh = meRes.ok ? await meRes.json() : {};
        if (fresh.reseller_status === 'approved' || fresh.reseller_status === 'onboarding') {
          const link = await fetchStripeAccountLink(fresh);
          if (link) { window.location.href = link; return; }
          throw new Error('Could not start Stripe setup. Please try again.');
        }
        throw new Error(await parseApiError(res));
      }
      throw new Error(await parseApiError(res));
    } catch (e) {
      alert(buildOnboardingSupportMessage(e.message));
    } finally {
      stripeBtn.disabled = false;
    }
  };
}

function renderMarketingAssets(referralCode) {
  const section = document.getElementById('reseller-marketing-section');
  if (!section) return;

  const code = (referralCode || '').trim();
  const shareLink = code
    ? `${window.location.origin}/?ref=${encodeURIComponent(code)}`
    : '';

  if (!code) {
    const noCodeEl = document.getElementById('reseller-marketing-nocode');
    if (noCodeEl) noCodeEl.style.display = 'block';
  }

  const slots = section.querySelectorAll('[data-ref-link-slot]');
  slots.forEach((slot) => {
    slot.textContent = shareLink || 'https://heyjunior.ai';
  });

  function copyToClipboard(text, btn) {
    const originalLabel = btn.textContent;
    function showCopied() {
      btn.classList.add('copied');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = originalLabel;
      }, 2000);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied).catch(() => {
        fallbackCopy(text, btn, showCopied);
      });
    } else {
      fallbackCopy(text, btn, showCopied);
    }
  }

  function fallbackCopy(text, btn, onSuccess) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch (_) {
      prompt('Copy this text:', text);
    }
    document.body.removeChild(ta);
  }

  const copyBtns = section.querySelectorAll('.reseller-marketing-copy-btn');
  copyBtns.forEach((btn) => {
    const targetId = btn.getAttribute('data-copy-target');
    if (!targetId) return;
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    if (!code) {
      btn.disabled = true;
      btn.title = 'Referral code not available';
    }

    btn.addEventListener('click', () => {
      const text = targetEl.textContent;
      copyToClipboard(text, btn);
    });
  });

  const printBtn = document.getElementById('btn-print-onepager');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const win = window.open('reseller-assets/one-pager.html', '_blank');
      if (win) {
        win.addEventListener('load', () => {
          win.print();
        });
      }
    });
  }
}
