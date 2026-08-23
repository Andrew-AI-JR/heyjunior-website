(function () {
    const API_BASE = window.getApiBaseUrl();

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

    async function startCheckout() {
        const token = tokenFromUrl();
        const errorEl = document.getElementById('checkout-error');
        const btn = document.getElementById('checkout-button');
        if (!token) {
            errorEl.textContent = 'This link is missing a token. Log in to the portal to subscribe.';
            errorEl.style.display = 'block';
            return;
        }
        btn.disabled = true;
        btn.textContent = 'Opening checkout...';
        errorEl.style.display = 'none';
        try {
            const response = await fetch(
                API_BASE + '/api/payments/abandoned-checkout-offer/' + encodeURIComponent(token) + '/checkout',
                { method: 'POST', headers: { 'Content-Type': 'application/json' } }
            );
            const data = await response.json().catch(function () { return {}; });
            if (!response.ok || !data.ok) {
                throw new Error(data.detail || data.error || 'Unable to start checkout.');
            }
            storeTokens(data);
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
                return;
            }
            window.location.href = 'portal.html';
        } catch (err) {
            errorEl.textContent = err.message || 'Unable to start checkout. Opening your portal instead.';
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Continue to checkout';
            setTimeout(function () {
                window.location.href = 'portal.html';
            }, 1600);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('checkout-button');
        if (btn) {
            btn.addEventListener('click', function (event) {
                event.preventDefault();
                startCheckout();
            });
        }
        if (!tokenFromUrl()) {
            const errorEl = document.getElementById('checkout-error');
            errorEl.textContent = 'This link is missing a token. Log in to the portal to subscribe.';
            errorEl.style.display = 'block';
            if (btn) btn.disabled = true;
        }
    });
})();
