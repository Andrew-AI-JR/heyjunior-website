/**
 * Partner program sign-up (partners.html): a free 30-day Junior Pro account, then payout setup.
 * POST /api/users/register-trial with source "partners".
 */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }

    function referralCode() {
        try {
            var stored = localStorage.getItem('referralCode');
            var at = parseInt(localStorage.getItem('referralTimestamp') || '0', 10);
            if (stored && Date.now() - at <= 30 * 864e5) return stored;
        } catch (e) { /* storage blocked */ }
        return null;
    }

    function showError(text) {
        var el = $('pp-error');
        el.textContent = text;
        el.style.display = text ? 'block' : 'none';
    }

    function errorText(status, data) {
        var detail = data && data.detail;
        var text = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail[0] && detail[0].msg) || '';
        if (status === 409) return 'You already have a Junior account with this email. Sign in below to join the partner program.';
        if (/uppercase/i.test(text)) return 'Your password needs at least one uppercase letter.';
        if (/8 characters/i.test(text)) return 'Your password needs at least 8 characters.';
        if (status === 422) return 'Please check your email address and password.';
        if (status === 429) return 'Too many tries. Please wait a minute and try again.';
        return 'We could not create your account just now. Please try again, or email support@heyjunior.ai.';
    }

    function storeTokens(data) {
        try {
            if (data.access_token) {
                sessionStorage.setItem('userToken', data.access_token);
                sessionStorage.setItem('accessToken', data.access_token);
            }
            if (data.refresh_token) sessionStorage.setItem('refreshToken', data.refresh_token);
        } catch (e) { /* storage blocked */ }
    }

    async function loadDownloads() {
        var wrap = $('pp-downloads');
        if (!wrap || !window.juniorReleaseManager) return;
        try {
            var release = await window.juniorReleaseManager.getLatestRelease();
            var links = (release && release.downloads) || {};
            wrap.innerHTML = '';
            [['Windows', links.windows], ['Mac (Apple chip)', links.macos_arm || links.macos], ['Mac (Intel)', links.macos_intel]]
                .forEach(function (pair) {
                    if (!pair[1]) return;
                    var a = document.createElement('a');
                    a.className = 'secondary-button on-light';
                    a.href = pair[1];
                    a.textContent = 'Download for ' + pair[0];
                    wrap.appendChild(a);
                });
        } catch (err) {
            wrap.textContent = 'You can download Junior any time from My Account.';
        }
    }

    async function join(event) {
        event.preventDefault();
        showError('');
        var email = $('pp-email').value.trim();
        var password = $('pp-password').value;
        if (!email || !$('pp-email').checkValidity()) return showError('Please enter a valid email address.');
        if (password.length < 8) return showError('Your password needs at least 8 characters.');
        if (!/[A-Z]/.test(password)) return showError('Your password needs at least one uppercase letter.');
        var button = $('pp-button');
        button.disabled = true;
        button.textContent = 'Creating your account...';
        try {
            var response = await fetch(window.getApiBaseUrl() + '/api/users/register-trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password, referral_code: referralCode(), source: 'partners' })
            });
            var data = await response.json().catch(function () { return {}; });
            if (response.status !== 201) return showError(errorText(response.status, data));
            storeTokens(data);
            if (data.trial_days) $('pp-success-days').textContent = data.trial_days;
            $('pp-form-wrap').style.display = 'none';
            $('pp-success').style.display = 'block';
            loadDownloads();
            if (typeof window.juniorTrack === 'function') window.juniorTrack('partner_signup', {});
        } catch (err) {
            showError('We could not connect. Please check your connection and try again.');
        } finally {
            button.disabled = false;
            button.textContent = 'Create my partner account';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var form = $('pp-form');
        if (form) form.addEventListener('submit', join);
    });
})();
