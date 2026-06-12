(function () {
    function safeTrack(name, payload) {
        if (typeof window.juniorTrack === 'function') {
            window.juniorTrack(name, payload || {});
        }
    }

    function showStatus(el, message, isError) {
        if (!el) return;
        el.hidden = false;
        el.textContent = message;
        el.classList.toggle('register-status-error', Boolean(isError));
        el.classList.toggle('register-status-success', !isError);
    }

    function clearStatus(statusEl, errorEl) {
        if (statusEl) {
            statusEl.hidden = true;
            statusEl.textContent = '';
        }
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('lbj-inline-signup-form');
        if (!form) return;

        var emailInput = document.getElementById('lbj-inline-email');
        var submitButton = document.getElementById('lbj-inline-submit');
        var submitText = document.getElementById('lbj-inline-submit-text');
        var statusEl = document.getElementById('lbj-inline-status');
        var errorEl = document.getElementById('lbj-inline-error');

        if (!emailInput || !submitButton || !submitText) return;

        safeTrack('landing_jobs_inline_signup_view', { placement: 'below-education', variant: 'email-first' });

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            clearStatus(statusEl, errorEl);

            var email = emailInput.value.trim();
            if (!isValidEmail(email)) {
                showStatus(errorEl, 'Please enter a valid email address.', true);
                emailInput.focus();
                safeTrack('landing_jobs_inline_register_error', { reason: 'validation' });
                return;
            }

            // Hand off to register.html: the jobboard-partner src triggers the
            // skip-email flow there, which pre-fills the email from sessionStorage.
            try {
                sessionStorage.setItem('juniorCapturedEmail', email);
            } catch (e) {
                // Private browsing can block sessionStorage; register.html will
                // simply show the email field, so this is non-fatal.
            }

            safeTrack('landing_jobs_email_captured', { placement: 'below-education' });

            submitButton.disabled = true;
            submitText.textContent = 'One moment...';
            showStatus(statusEl, 'Taking you to the signup page...', false);

            // Preserve coupon from URL if present
            var qs = new URLSearchParams(window.location.search);
            var coupon = qs.get('coupon');
            var target = 'register.html?src=jobboard-partner&plan=basic';
            if (coupon) {
                target += '&coupon=' + encodeURIComponent(coupon.trim().toUpperCase());
            }
            window.location.href = target;
        });
    });
})();
