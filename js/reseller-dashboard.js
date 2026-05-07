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

const REGION_DATA = {
  global: {
    images: [
      { label: 'LinkedIn Post', file: 'linkedin-post.png' },
      { label: 'Square Social', file: 'square-social.png' },
      { label: 'Social Card', file: 'social-card.png' },
    ],
    emails: [
      { label: 'Cold outreach', text: 'Subject: Something that helped me find the right LinkedIn conversations\n\nHi [Name],\n\nI wanted to share a tool I have been using called Hey Junior. It cuts through the noise on LinkedIn and surfaces the posts and conversations that actually matter for your job search -- the ones where recruiters and hiring managers are active.\n\nInstead of scrolling for hours hoping to be seen, Junior helps you show up in the right discussions with relevant, thoughtful engagement.\n\nIt takes a few minutes to set up and the first month is free.\n\nHave a look here: {{LINK}}\n\nHappy to share more about my experience.\n\nBest regards,\n[Your name]' },
      { label: 'Follow-up', text: 'Subject: Re: Hey Junior\n\nHi [Name],\n\nJust following up on Hey Junior. Since I started using it, I have been part of more meaningful LinkedIn conversations and my profile views have gone up noticeably. Recruiters are reaching out more because I am showing up in the right places.\n\nYou tell it what kind of roles and industries you care about, and it finds the conversations worth joining. The first month is free.\n\nHere is my link: {{LINK}}\n\nLet me know if you have questions.\n\nBest regards,\n[Your name]' },
      { label: 'Warm referral', text: 'Subject: Something that might help your job search\n\nHi [Name],\n\nI know you have been exploring new opportunities, so I thought this might be useful. Hey Junior is a LinkedIn assistant that helps you find and engage in the conversations that lead to real connections -- not just noise.\n\nIt has been working really well for me. Setup takes a few minutes and the first month is free.\n\nYou can try it here: {{LINK}}\n\nWishing you the best,\n[Your name]' },
    ],
    captions: [
      'LinkedIn is full of noise. Hey Junior cuts through it and helps you find the conversations that actually lead to opportunities. {{LINK}}',
      'The best job opportunities come from real conversations. Hey Junior helps you find and engage in the right ones on LinkedIn. {{LINK}}',
      'Recruiters notice people who show up in meaningful discussions. Hey Junior helps you be one of them. {{LINK}}',
      'Stop scrolling past the posts that matter. Hey Junior surfaces the LinkedIn conversations worth joining. {{LINK}}',
      'Your next opportunity is hiding in a LinkedIn conversation. Hey Junior helps you find it. {{LINK}}',
    ],
  },
  latam: {
    images: [
      { label: 'LinkedIn Post', file: 'linkedin-post.png' },
      { label: 'Square Social', file: 'square-social.png' },
      { label: 'Social Card', file: 'social-card.png' },
    ],
    emails: [
      { label: 'Contacto inicial', text: 'Asunto: Algo que me ayudo a encontrar las conversaciones correctas en LinkedIn\n\nHola [Nombre],\n\nQueria compartirte algo que me ha funcionado muy bien. Se llama Hey Junior y te ayuda a encontrar las publicaciones y conversaciones en LinkedIn donde realmente vale la pena participar -- donde estan los reclutadores y las oportunidades.\n\nEn vez de perder horas navegando, Junior te muestra donde estar presente con participacion relevante y genuina.\n\nSe configura en minutos y el primer mes es gratis.\n\nMiralo aqui: {{LINK}}\n\nCon gusto te cuento mas.\n\nSaludos,\n[Tu nombre]' },
      { label: 'Seguimiento', text: 'Asunto: Re: Hey Junior\n\nHola [Nombre],\n\nQueria darte seguimiento sobre Hey Junior. Desde que lo uso, estoy participando en conversaciones mucho mas relevantes en LinkedIn y mis vistas de perfil han aumentado bastante. Los reclutadores me escriben mas porque estoy presente en las discusiones correctas.\n\nTu le dices que tipo de roles e industrias te interesan y el encuentra las conversaciones que valen la pena. El primer mes es gratis.\n\nAqui esta mi enlace: {{LINK}}\n\nCualquier duda, con confianza.\n\nSaludos,\n[Tu nombre]' },
      { label: 'Recomendacion personal', text: 'Asunto: Esto te puede servir en tu busqueda\n\nHola [Nombre],\n\nSe que has estado buscando nuevas oportunidades, asi que quise pasarte esto. Hey Junior es un asistente de LinkedIn que te ayuda a encontrar y participar en las conversaciones que generan conexiones reales, no solo ruido.\n\nMe ha funcionado muy bien. Se configura en minutos y el primer mes es completamente gratis.\n\nPruebalo aqui: {{LINK}}\n\nMucho exito,\n[Tu nombre]' },
    ],
    captions: [
      'LinkedIn esta lleno de ruido. Hey Junior te ayuda a encontrar las conversaciones que realmente llevan a oportunidades. {{LINK}}',
      'Las mejores oportunidades nacen de conversaciones reales. Hey Junior te ayuda a encontrarlas y participar. {{LINK}}',
      'Los reclutadores notan a quienes participan en discusiones relevantes. Hey Junior te ayuda a estar ahi. {{LINK}}',
      'Deja de pasar de largo las publicaciones que importan. Hey Junior te muestra las conversaciones que valen la pena en LinkedIn. {{LINK}}',
      'Tu proxima oportunidad esta en una conversacion de LinkedIn. Hey Junior te ayuda a encontrarla. {{LINK}}',
    ],
  },
  europe: {
    images: [
      { label: 'LinkedIn Post', file: 'linkedin-post.png' },
      { label: 'Square Social', file: 'square-social.png' },
      { label: 'Social Card', file: 'social-card.png' },
    ],
    emails: [
      { label: 'Introduction', text: 'Subject: A useful tool for finding the right LinkedIn conversations\n\nDear [Name],\n\nI wanted to mention a tool I have been using called Hey Junior. Rather than leaving you to scroll through endless posts, it identifies the LinkedIn conversations that are genuinely relevant to your career -- where recruiters and hiring managers are actively engaged.\n\nIt helps you show up in the right discussions with thoughtful, relevant engagement. Setup takes just a few minutes, and the first month is complimentary.\n\nYou can find it here: {{LINK}}\n\nI am happy to share more about how it has worked for me.\n\nKind regards,\n[Your name]' },
      { label: 'Follow-up', text: 'Subject: Re: Hey Junior\n\nDear [Name],\n\nI wanted to follow up regarding Hey Junior. Since I began using it, I have been engaging in more meaningful LinkedIn conversations and have had several recruiter enquiries I would not have received otherwise.\n\nYou set your preferences and it surfaces the posts worth engaging with. The first month is free of charge.\n\nHere is my link: {{LINK}}\n\nDo let me know if you have any questions.\n\nKind regards,\n[Your name]' },
      { label: 'Personal recommendation', text: 'Subject: Something that may assist your job search\n\nDear [Name],\n\nI understand you have been exploring new opportunities, so I thought this might be of interest. Hey Junior is a LinkedIn assistant that helps you find and join the conversations that lead to genuine connections.\n\nIt has been working well for me. Setup is straightforward and the first month is free.\n\nYou can try it here: {{LINK}}\n\nWishing you every success,\n[Your name]' },
    ],
    captions: [
      'LinkedIn is full of noise. Hey Junior helps you find the conversations that genuinely matter for your career. {{LINK}}',
      'The right opportunities come from the right conversations. Hey Junior helps you find and join them on LinkedIn. {{LINK}}',
      'Recruiters notice professionals who engage in meaningful discussions. Hey Junior helps you be present where it counts. {{LINK}}',
      'Rather than scrolling past the posts that matter, let Hey Junior surface the LinkedIn conversations worth joining. {{LINK}}',
      'Your next career opportunity may be one conversation away. Hey Junior helps you find it. {{LINK}}',
    ],
  },
  apac: {
    images: [
      { label: 'LinkedIn Post', file: 'linkedin-post.png' },
      { label: 'Square Social', file: 'square-social.png' },
      { label: 'Social Card', file: 'social-card.png' },
    ],
    emails: [
      { label: 'Introduction', text: 'Subject: A professional tool for finding meaningful LinkedIn conversations\n\nDear [Name],\n\nI would like to share a tool that has been valuable in my professional journey. Hey Junior helps you identify and engage with the LinkedIn conversations that are most relevant to your career goals, ensuring you are present in the discussions where recruiters and hiring professionals are active.\n\nThe setup process takes only a few minutes, and the first month is provided at no cost.\n\nPlease find it here: {{LINK}}\n\nI would be happy to discuss my experience in more detail.\n\nWith best regards,\n[Your name]' },
      { label: 'Follow-up', text: 'Subject: Re: Hey Junior\n\nDear [Name],\n\nI wanted to follow up regarding Hey Junior. Since I began using the platform, I have been part of more meaningful LinkedIn discussions and have received enquiries from several recruiters as a result.\n\nYou define your professional interests and Hey Junior surfaces the conversations worth engaging with. The first month is complimentary.\n\nHere is my referral link: {{LINK}}\n\nPlease do not hesitate to reach out with any questions.\n\nWith best regards,\n[Your name]' },
      { label: 'Personal recommendation', text: 'Subject: A recommendation for your career search\n\nDear [Name],\n\nI understand you are currently exploring new career opportunities, and I thought this might be of value. Hey Junior is a professional LinkedIn assistant that helps you discover and participate in conversations that lead to genuine connections with recruiters and hiring professionals.\n\nI have found it to be very effective. The initial setup is straightforward and your first month is free of charge.\n\nYou may try it here: {{LINK}}\n\nWishing you every success in your search,\n[Your name]' },
    ],
    captions: [
      'For professionals seeking new opportunities, Hey Junior helps you discover the LinkedIn conversations that lead to genuine connections. {{LINK}}',
      'Hey Junior surfaces the LinkedIn discussions that matter most for your career, helping you engage where it counts. {{LINK}}',
      'Recruiters value professionals who participate in meaningful discussions. Hey Junior helps ensure you are present in the right ones. {{LINK}}',
      'Currently seeking new career opportunities? Hey Junior helps you find and join the LinkedIn conversations that lead to results. {{LINK}}',
      'Building professional connections requires engaging in the right conversations. Hey Junior helps you find them on LinkedIn. {{LINK}}',
    ],
  },
};

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

  const regionSelect = document.getElementById('reseller-region-select');
  const saved = localStorage.getItem('reseller_region');
  if (saved && REGION_DATA[saved]) {
    regionSelect.value = saved;
  }

  function populateRegion(region) {
    const data = REGION_DATA[region] || REGION_DATA.global;
    const basePath = `reseller-assets/${region}/social/`;

    const imgContainer = document.getElementById('reseller-marketing-images');
    imgContainer.innerHTML = data.images.map((img) =>
      '<div class="reseller-marketing-card">' +
        '<img src="' + escapeHtml(basePath + img.file) + '" alt="' + escapeHtml(img.label) + '" loading="lazy">' +
        '<div class="reseller-marketing-card-body">' +
          '<span>' + escapeHtml(img.label) + '</span>' +
          '<a href="' + escapeHtml(basePath + img.file) + '" download="heyjunior-' + escapeHtml(img.file) + '">Download</a>' +
        '</div>' +
      '</div>'
    ).join('');

    const link = shareLink || 'https://heyjunior.ai';

    const emailContainer = document.getElementById('reseller-marketing-emails');
    emailContainer.innerHTML = data.emails.map((e, i) => {
      const id = 'email-' + region + '-' + i;
      const content = e.text.replace(/\{\{LINK\}\}/g, link);
      return '<div class="reseller-marketing-block">' +
        '<span class="reseller-marketing-block-label">' + escapeHtml(e.label) + '</span>' +
        '<button type="button" class="reseller-marketing-copy-btn" data-copy-id="' + id + '"' +
          (!code ? ' disabled title="Referral code not available"' : '') + '>Copy</button>' +
        '<div class="reseller-marketing-block-text" id="' + id + '">' + escapeHtml(content) + '</div>' +
      '</div>';
    }).join('');

    const captionContainer = document.getElementById('reseller-marketing-captions');
    captionContainer.innerHTML = data.captions.map((c, i) => {
      const id = 'caption-' + region + '-' + i;
      const content = c.replace(/\{\{LINK\}\}/g, link);
      return '<div class="reseller-marketing-block">' +
        '<span class="reseller-marketing-block-label">Caption ' + (i + 1) + '</span>' +
        '<button type="button" class="reseller-marketing-copy-btn" data-copy-id="' + id + '"' +
          (!code ? ' disabled title="Referral code not available"' : '') + '>Copy</button>' +
        '<div class="reseller-marketing-block-text" id="' + id + '">' + escapeHtml(content) + '</div>' +
      '</div>';
    }).join('');

    wireCopyButtons();
  }

  function wireCopyButtons() {
    section.querySelectorAll('.reseller-marketing-copy-btn').forEach((btn) => {
      const targetId = btn.getAttribute('data-copy-id');
      if (!targetId) return;
      btn.onclick = () => {
        const el = document.getElementById(targetId);
        if (!el) return;
        copyToClipboard(el.textContent, btn);
      };
    });
  }

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
        fallbackCopy(text, showCopied);
      });
    } else {
      fallbackCopy(text, showCopied);
    }
  }

  function fallbackCopy(text, onSuccess) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); onSuccess(); }
    catch (_) { prompt('Copy this text:', text); }
    document.body.removeChild(ta);
  }

  regionSelect.addEventListener('change', () => {
    const region = regionSelect.value;
    localStorage.setItem('reseller_region', region);
    populateRegion(region);
  });

  populateRegion(regionSelect.value);

  const printBtn = document.getElementById('btn-print-onepager');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const win = window.open('reseller-assets/one-pager.html', '_blank');
      if (win) {
        win.addEventListener('load', () => { win.print(); });
      }
    });
  }
}
