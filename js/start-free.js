// Personal 14-day no-card trial links from Junior's outbound emails (start-free.html?t=...).
(function () {
    const API_BASE = window.getApiBaseUrl();
    const PLAN_NAMES = { pro: 'Pro', enterprise: 'Enterprise', basic: 'Basic' };

    function $(id) {
        return document.getElementById(id);
    }

    function token() {
        return new URLSearchParams(window.location.search).get('t') || '';
    }

    function setAll(selector, text) {
        document.querySelectorAll(selector).forEach(function (el) { el.textContent = text; });
    }

    function showError(text) {
        const el = $('sf-error');
        el.textContent = text;
        el.style.display = text ? 'block' : 'none';
    }

    function show(id) {
        ['sf-form-wrap', 'sf-invalid-wrap', 'sf-success-wrap'].forEach(function (name) {
            $(name).style.display = name === id ? 'flex' : 'none';
        });
    }

    function showInvalid(reason) {
        if (reason === 'revoked') {
            $('sf-invalid-title').textContent = 'This link is no longer active';
        } else if (reason === 'not_found') {
            $('sf-invalid-title').textContent = 'We could not find this link';
        }
        show('sf-invalid-wrap');
    }

    function applyOffer(offer) {
        const plan = PLAN_NAMES[offer.plan] || 'Pro';
        setAll('.plan-name', plan);
        if (offer.trial_days) setAll('.trial-days', String(offer.trial_days));
        $('sf-company-line').style.display = offer.plan === 'enterprise' ? 'list-item' : 'none';
        $('sf-email').value = offer.email || '';
    }

    function errorText(status, data) {
        const detail = data && data.detail;
        const text = typeof detail === 'string' ? detail : '';
        if (data && data.error_code === 'email_registered') {
            return 'That email already has a Junior account. Sign in at heyjunior.ai/portal.html instead.';
        }
        if (status === 410) return 'This offer has expired.';
        if (/uppercase/i.test(text)) return 'Your password needs at least one uppercase letter.';
        if (/8 characters/i.test(text)) return 'Your password needs at least 8 characters.';
        if (status === 429) return 'Too many tries. Please wait a minute and try again.';
        if (status === 400 && text) return text;
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

    async function loadDownloads() {
        const wrap = $('sf-downloads');
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

    async function loadOffer() {
        const t = token();
        if (!t) return showInvalid('not_found');
        try {
            // view=1 marks a real page visit; email scanners fetching the link do not run this.
            const response = await fetch(API_BASE + '/api/payments/outbound-offer/' + encodeURIComponent(t) + '?view=1');
            const offer = await response.json().catch(function () { return {}; });
            if (!offer.valid) return showInvalid(offer.reason);
            applyOffer(offer);
            if (offer.status && offer.status !== 'pending') {
                showError('This trial was already started. Sign in at heyjunior.ai/portal.html.');
            }
        } catch (err) {
            showError('We could not load your offer. Please check your connection and refresh.');
        }
    }

    async function claim(event) {
        event.preventDefault();
        showError('');
        const emailInput = $('sf-email');
        const email = emailInput.value.trim();
        const password = $('sf-password').value;
        if (!email || !emailInput.checkValidity()) return showError('Please enter a valid email address.');
        if (password.length < 8) return showError('Your password needs at least 8 characters.');
        if (!/[A-Z]/.test(password)) return showError('Your password needs at least one uppercase letter.');

        const button = $('sf-button');
        button.disabled = true;
        button.textContent = 'Starting your trial...';
        try {
            const response = await fetch(API_BASE + '/api/payments/outbound-offer/' + encodeURIComponent(token()) + '/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            });
            const data = await response.json().catch(function () { return {}; });
            if (!response.ok) return showError(errorText(response.status, data));
            if (data.already_claimed) {
                return showError('This trial was already started. Sign in at heyjunior.ai/portal.html.');
            }
            storeTokens(data);
            if (data.trial_days) setAll('.trial-days', String(data.trial_days));
            show('sf-success-wrap');
            loadDownloads();
            if (typeof window.juniorTrack === 'function') {
                window.juniorTrack('outbound_trial_started', { plan: data.plan || '' });
            }
        } catch (err) {
            showError('We could not connect. Please check your connection and try again.');
        } finally {
            button.disabled = false;
            button.textContent = 'Start my free trial';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        $('sf-form').addEventListener('submit', claim);
        $('sf-change-email').addEventListener('click', function () {
            const input = $('sf-email');
            input.readOnly = false;
            input.value = '';
            input.focus();
            this.style.display = 'none';
        });
        loadOffer();
    });
})();
