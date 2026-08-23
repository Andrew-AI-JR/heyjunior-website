(function () {
    const API_BASE = window.getApiBaseUrl();

    function $(id) {
        return document.getElementById(id);
    }

    function tokenFromUrl() {
        return new URLSearchParams(window.location.search).get('token') || '';
    }

    function storeTokens(data) {
        if (data.access_token) {
            sessionStorage.setItem('userToken', data.access_token);
            sessionStorage.setItem('accessToken', data.access_token);
        }
        if (data.refresh_token) {
            sessionStorage.setItem('refreshToken', data.refresh_token);
        }
    }

    async function loadDownloads() {
        const wrap = $('claim-downloads');
        if (!wrap || !window.juniorReleaseManager) return;
        try {
            const release = await window.juniorReleaseManager.getLatestRelease();
            const links = release && release.downloads ? release.downloads : {};
            wrap.innerHTML = '';
            [
                ['Windows', links.windows],
                ['macOS', links.macos_arm || links.macos_intel || links.macos],
                ['Linux', links.linux_appimage || links.linux_deb || links.linux],
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
            wrap.textContent = 'Open the portal to download Junior.';
        }
    }

    async function activate() {
        const token = tokenFromUrl();
        const errorEl = $('claim-error');
        const btn = $('claim-button');
        if (!token) {
            errorEl.textContent = 'This link is missing a token. Open the email again or log in to the portal.';
            errorEl.style.display = 'block';
            return;
        }
        btn.disabled = true;
        btn.textContent = 'Activating...';
        errorEl.style.display = 'none';
        try {
            const response = await fetch(
                API_BASE + '/api/payments/abandoned-checkout-offer/' + encodeURIComponent(token) + '/claim',
                { method: 'POST', headers: { 'Content-Type': 'application/json' } }
            );
            const data = await response.json().catch(function () { return {}; });
            if (!response.ok || !data.ok) {
                throw new Error(data.detail || data.error || 'Unable to activate this offer.');
            }
            storeTokens(data);
            $('claim-form-wrap').style.display = 'none';
            $('claim-success-wrap').style.display = 'flex';
            await loadDownloads();
        } catch (err) {
            errorEl.textContent = err.message || 'Unable to activate this offer.';
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Activate my 30-day free trial';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const btn = $('claim-button');
        if (btn) {
            btn.addEventListener('click', function (event) {
                event.preventDefault();
                activate();
            });
        }
        if (!tokenFromUrl()) {
            const errorEl = $('claim-error');
            errorEl.textContent = 'This link is missing a token. Open the email again or log in to the portal.';
            errorEl.style.display = 'block';
            if (btn) btn.disabled = true;
        }
    });
})();
