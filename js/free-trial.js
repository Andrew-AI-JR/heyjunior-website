(function () {
    const API_BASE = window.getApiBaseUrl();

    function $(id) {
        return document.getElementById(id);
    }

    function params() {
        return new URLSearchParams(window.location.search);
    }

    // Referral: ?ref=CODE (or ?via=CODE), kept 30 days like the rest of heyjunior.ai.
    function referralCode() {
        const code = params().get('ref') || params().get('via');
        try {
            if (code) {
                localStorage.setItem('referralCode', code.toUpperCase());
                localStorage.setItem('referralTimestamp', String(Date.now()));
            }
            const stored = localStorage.getItem('referralCode');
            const at = parseInt(localStorage.getItem('referralTimestamp') || '0', 10);
            if (stored && Date.now() - at <= 30 * 864e5) return stored;
        } catch (e) {}
        return code ? code.toUpperCase() : null;
    }

    function showError(text) {
        const el = $('trial-error');
        el.textContent = text;
        el.style.display = text ? 'block' : 'none';
    }

    function errorText(status, data) {
        const detail = data && data.detail;
        const text = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail[0] && detail[0].msg) || '';
        if (status === 409) return 'You already have a Junior account with this email. Sign in at heyjunior.ai/portal.html to pick a plan.';
        if (/uppercase/i.test(text)) return 'Your password needs at least one uppercase letter.';
        if (/8 characters/i.test(text)) return 'Your password needs at least 8 characters.';
        if (status === 422) return 'Please check your email address and password.';
        if (status === 429) return 'Too many tries. Please wait a minute and try again.';
        return 'We could not start your trial just now. Please try again, or email support@heyjunior.ai.';
    }

    function storeTokens(data) {
        try {
            if (data.access_token) {
                sessionStorage.setItem('userToken', data.access_token);
                sessionStorage.setItem('accessToken', data.access_token);
            }
            if (data.refresh_token) sessionStorage.setItem('refreshToken', data.refresh_token);
        } catch (e) {}
    }

    function setDays(days) {
        $('trial-days-title').textContent = days;
        document.querySelectorAll('.trial-days').forEach(function (el) { el.textContent = days; });
    }

    async function loadDownloads() {
        const wrap = $('trial-downloads');
        if (!wrap || !window.juniorReleaseManager) return;
        try {
            const release = await window.juniorReleaseManager.getLatestRelease();
            const links = release && release.downloads ? release.downloads : {};
            wrap.innerHTML = '';
            [
                ['Windows', links.windows],
                ['Mac (Apple chip)', links.macos_arm || links.macos],
                ['Mac (Intel)', links.macos_intel],
            ].forEach(function (pair) {
                if (!pair[1]) return;
                const a = document.createElement('a');
                a.className = 'primary-button';
                a.href = pair[1];
                a.textContent = 'Download for ' + pair[0];
                a.style.display = 'inline-block';
                a.style.margin = '6px';
                wrap.appendChild(a);
            });
        } catch (err) {
            wrap.textContent = 'Sign in at heyjunior.ai/portal.html to download Junior.';
        }
    }

    async function start(event) {
        event.preventDefault();
        showError('');
        const email = $('trial-email').value.trim();
        const password = $('trial-password').value;
        if (!email || !$('trial-email').checkValidity()) return showError('Please enter a valid email address.');
        if (password.length < 8) return showError('Your password needs at least 8 characters.');
        if (!/[A-Z]/.test(password)) return showError('Your password needs at least one uppercase letter.');

        const button = $('trial-button');
        button.disabled = true;
        button.textContent = 'Starting your trial...';
        try {
            const response = await fetch(API_BASE + '/api/users/register-trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    referral_code: referralCode(),
                    source: params().get('src') || params().get('utm_source') || null
                })
            });
            const data = await response.json().catch(function () { return {}; });
            if (response.status !== 201) {
                showError(errorText(response.status, data));
                return;
            }
            storeTokens(data);
            if (data.trial_days) setDays(data.trial_days);
            $('trial-form-wrap').style.display = 'none';
            $('trial-success-wrap').style.display = 'flex';
            loadDownloads();
            if (typeof window.juniorTrack === 'function') {
                window.juniorTrack('open_trial_started', { source: params().get('src') || '' });
            }
        } catch (err) {
            showError('We could not connect. Please check your connection and try again.');
        } finally {
            button.disabled = false;
            button.textContent = 'Start my free trial';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        referralCode();
        $('trial-form').addEventListener('submit', start);
    });
})();
