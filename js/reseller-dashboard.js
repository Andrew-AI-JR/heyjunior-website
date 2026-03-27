/* reseller-dashboard.js - Reseller Dashboard for Commission Tracking and Stripe Connect Management */

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.origin.replace(/:\d+$/, ':8000')
    : 'https://api.heyjunior.ai';

let currentUserToken = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');

    const logoutLink = document.getElementById('logout-link');
    const logoutSeparator = document.getElementById('logout-separator');
    if (logoutLink) {
        if (token) {
            logoutLink.style.display = 'block';
            if (logoutSeparator) logoutSeparator.style.display = 'inline';
        } else {
            logoutLink.style.display = 'none';
            if (logoutSeparator) logoutSeparator.style.display = 'none';
        }
    }

    if (!token) {
        document.getElementById('login-required').style.display = 'block';
        return;
    }

    currentUserToken = token;
    document.getElementById('loading-state').style.display = 'block';

    try {
        const userData = await fetchWithAuth(`${API_BASE_URL}/api/users/me`);
        if (!userData) return;

        const user = await userData.json();

        document.getElementById('loading-state').style.display = 'none';

        if (!user.is_reseller) {
            document.getElementById('not-reseller').style.display = 'block';
            return;
        }

        switch (user.reseller_status) {
            case 'pending':
                document.getElementById('pending-approval').style.display = 'block';
                return;
            case 'approved':
            case 'onboarding':
                document.getElementById('onboarding-section').style.display = 'block';
                return;
            case 'suspended':
                document.getElementById('suspended-section').style.display = 'block';
                return;
            case 'active':
                await loadActiveDashboard(user);
                break;
            default:
                document.getElementById('not-reseller').style.display = 'block';
        }
    } catch (error) {
        console.error('Failed to load reseller dashboard:', error);
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('login-required').style.display = 'block';
    }

    handleOnboardingReturn();
});


async function fetchWithAuth(url, options = {}) {
    let token = currentUserToken || sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
    let headers = { ...options.headers };

    if (!token) {
        throw new Error('No authentication token available');
    }

    headers['Authorization'] = `Bearer ${token}`;
    headers['Content-Type'] = 'application/json';

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        sessionStorage.clear();
        window.location.href = 'portal.html';
        return null;
    }

    return response;
}


async function loadActiveDashboard(user) {
    document.getElementById('reseller-dashboard').style.display = 'block';

    // Set referral link
    const referralCode = user.referral_code || '';
    if (referralCode) {
        const baseUrl = window.location.origin;
        document.getElementById('reseller-referral-link').value = `${baseUrl}?ref=${referralCode}`;
    }

    // Load dashboard summary and referrals in parallel
    const [dashboardData, referralsData] = await Promise.all([
        loadDashboardSummary(),
        loadReferralsList(),
    ]);

    if (dashboardData) {
        displaySummary(dashboardData);
    }
    if (referralsData) {
        displayReferrals(referralsData);
    }
}


async function loadDashboardSummary() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/resellers/dashboard`);
        if (!response || !response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Failed to load dashboard summary:', error);
        return null;
    }
}


async function loadReferralsList() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/resellers/referrals`);
        if (!response || !response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Failed to load referrals list:', error);
        return null;
    }
}


function displaySummary(data) {
    const formatCents = (cents) => {
        const dollars = (cents || 0) / 100;
        return '$' + dollars.toFixed(2);
    };

    document.getElementById('total-earned').textContent = formatCents(data.total_earned_cents);
    document.getElementById('month-earned').textContent = formatCents(data.current_month_cents);
    document.getElementById('active-referrals').textContent = data.active_referrals || 0;
    document.getElementById('total-referrals').textContent = data.total_referrals || 0;

    // Update referral link if available from dashboard data
    if (data.referral_code) {
        const baseUrl = window.location.origin;
        document.getElementById('reseller-referral-link').value = `${baseUrl}?ref=${data.referral_code}`;
    }
}


function displayReferrals(data) {
    const container = document.getElementById('referrals-list');
    const referrals = data.referrals || [];

    if (referrals.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #6b7280;">
                <p style="font-size: 1.5rem; margin-bottom: 10px;">📋</p>
                <p>No referrals yet. Share your link to start earning!</p>
            </div>
        `;
        return;
    }

    let html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="border-bottom: 2px solid #e2e8f0;">
                        <th style="text-align: left; padding: 10px 12px; color: #6b7280; font-weight: 600;">Email</th>
                        <th style="text-align: left; padding: 10px 12px; color: #6b7280; font-weight: 600;">Signed Up</th>
                        <th style="text-align: center; padding: 10px 12px; color: #6b7280; font-weight: 600;">Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    referrals.forEach(ref => {
        const signedUp = new Date(ref.signed_up).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        const statusBadge = ref.is_active
            ? '<span style="background: #d1fae5; color: #065f46; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">Active</span>'
            : '<span style="background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">Inactive</span>';

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; color: #374151;">${escapeHtml(ref.email)}</td>
                <td style="padding: 12px; color: #6b7280;">${signedUp}</td>
                <td style="padding: 12px; text-align: center;">${statusBadge}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


function copyResellerLink() {
    const input = document.getElementById('reseller-referral-link');
    const button = document.getElementById('copy-link-btn');

    if (!input || input.value === 'Loading...') return;

    navigator.clipboard.writeText(input.value).then(() => {
        const original = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = '#059669';
        setTimeout(() => {
            button.textContent = original;
            button.style.background = '';
        }, 2000);
    }).catch(() => {
        input.select();
        document.execCommand('copy');
    });
}
window.copyResellerLink = copyResellerLink;


async function openStripeDashboard() {
    const button = document.getElementById('stripe-dashboard-btn');
    const errorEl = document.getElementById('stripe-dashboard-error');

    button.disabled = true;
    button.textContent = 'Opening...';
    errorEl.style.display = 'none';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/resellers/stripe-login`);
        if (!response || !response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to generate dashboard link');
        }

        const data = await response.json();
        if (data.login_url) {
            window.open(data.login_url, '_blank');
        } else {
            throw new Error('No login URL returned');
        }
    } catch (error) {
        errorEl.textContent = error.message || 'Failed to open payout dashboard. Please try again.';
        errorEl.style.display = 'block';
    } finally {
        button.disabled = false;
        button.textContent = 'Open Payout Dashboard';
    }
}
window.openStripeDashboard = openStripeDashboard;


async function startOnboarding() {
    const button = document.getElementById('start-onboarding-btn');
    const errorEl = document.getElementById('onboarding-error');

    button.disabled = true;
    button.textContent = 'Setting up...';
    errorEl.style.display = 'none';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/resellers/onboard`, {
            method: 'POST',
        });

        if (!response || !response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to start onboarding');
        }

        const data = await response.json();
        if (data.onboarding_url) {
            window.location.href = data.onboarding_url;
        } else {
            throw new Error('No onboarding URL returned');
        }
    } catch (error) {
        errorEl.textContent = error.message || 'Failed to start payout setup. Please try again.';
        errorEl.style.display = 'block';
        button.disabled = false;
        button.textContent = 'Set Up Payout Account';
    }
}
window.startOnboarding = startOnboarding;


async function handleOnboardingReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const onboarding = urlParams.get('onboarding');

    if (!onboarding) return;

    const banner = document.getElementById('onboarding-return-banner');
    const message = document.getElementById('onboarding-return-message');

    if (onboarding === 'refresh') {
        // Onboarding link expired, generate a fresh one
        banner.style.display = 'block';
        message.textContent = 'Your setup link expired. Generating a new one...';
        message.style.color = '#92400e';
        banner.style.background = '#fef3c7';
        banner.style.borderColor = '#f59e0b';

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/resellers/onboard/refresh`);
            if (response && response.ok) {
                const data = await response.json();
                if (data.onboarding_url) {
                    window.location.href = data.onboarding_url;
                    return;
                }
            }
            message.textContent = 'Could not generate a new setup link. Please try again.';
        } catch {
            message.textContent = 'Could not generate a new setup link. Please try again.';
        }
    }

    if (onboarding === 'complete') {
        banner.style.display = 'block';
        message.textContent = 'Verifying your payout account setup...';

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/resellers/onboard/return`);
            if (response && response.ok) {
                const data = await response.json();
                if (data.status === 'active') {
                    message.textContent = 'Payout account setup complete! Your dashboard is ready.';
                    // Reload after a moment to show full dashboard
                    setTimeout(() => {
                        window.location.href = 'reseller-dashboard.html';
                    }, 2000);
                } else if (data.details_submitted) {
                    message.textContent = 'Your information has been submitted. Stripe is verifying your account. This may take a few minutes.';
                } else {
                    message.textContent = 'Your setup is not yet complete. Please finish all required steps.';
                    message.style.color = '#92400e';
                    banner.style.background = '#fef3c7';
                    banner.style.borderColor = '#f59e0b';
                }
            }
        } catch {
            message.textContent = 'Could not verify account status. Please refresh the page.';
        }
    }

    // Clean up URL params
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}


function handleLogout(event) {
    if (event) event.preventDefault();
    sessionStorage.clear();
    localStorage.removeItem('partnerPaymentLink');
    window.location.href = 'portal.html';
}
window.handleLogout = handleLogout;
