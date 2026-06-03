(function () {
    function safeTrack(name, payload) {
        if (typeof window.juniorTrack === 'function') {
            window.juniorTrack(name, payload || {});
        }
    }

    function clearStatus(statusEl, errorEl) {
        if (statusEl) {
            statusEl.hidden = true;
            statusEl.textContent = '';
            statusEl.classList.remove('register-status-error');
            statusEl.classList.remove('register-status-success');
        }
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = '';
            errorEl.innerHTML = '';
            errorEl.classList.remove('register-status-success');
            errorEl.classList.add('register-status-error');
        }
    }

    function showStatus(el, message, isError) {
        if (!el) return;
        el.hidden = false;
        el.textContent = message;
        el.classList.toggle('register-status-error', Boolean(isError));
        el.classList.toggle('register-status-success', !isError);
    }

    function showDuplicateEmailError(element) {
        if (!element) return;
        element.hidden = false;
        element.classList.remove('register-status-success');
        element.classList.add('register-status-error');
        element.innerHTML = '';

        var intro = document.createElement('span');
        intro.textContent = 'Looks like you already have an account. ';

        var login = document.createElement('a');
        login.href = 'portal.html';
        login.textContent = 'Log in here';

        var separator = document.createTextNode(' or ');

        var forgot = document.createElement('a');
        forgot.href = 'forgot-password.html';
        forgot.textContent = 'reset your password';

        element.appendChild(intro);
        element.appendChild(login);
        element.appendChild(separator);
        element.appendChild(forgot);
        element.appendChild(document.createTextNode('.'));
    }

    function clearFieldValidity(fields) {
        fields.forEach(function (field) {
            if (field && typeof field.setCustomValidity === 'function') {
                field.setCustomValidity('');
            }
        });
    }

    function showValidationFeedback(validationError, refs) {
        var emailInput = refs.emailInput;
        var passwordInput = refs.passwordInput;
        var confirmInput = refs.confirmInput;
        var termsInput = refs.termsInput;

        clearFieldValidity([emailInput, passwordInput, confirmInput, termsInput]);

        if (!validationError) return;

        if (validationError.indexOf('email') !== -1) {
            emailInput.setCustomValidity(validationError);
            emailInput.reportValidity();
            emailInput.focus();
            return;
        }

        if (validationError.indexOf('uppercase') !== -1 || validationError.indexOf('8 characters') !== -1) {
            passwordInput.setCustomValidity(validationError);
            passwordInput.reportValidity();
            passwordInput.focus();
            return;
        }

        if (validationError.indexOf('confirm') !== -1 || validationError.indexOf('match') !== -1) {
            confirmInput.setCustomValidity(validationError);
            confirmInput.reportValidity();
            confirmInput.focus();
            return;
        }

        if (validationError.indexOf('Terms') !== -1) {
            termsInput.focus();
        }
    }

    function setLoadingState(elements, isLoading) {
        if (!elements.submitButton || !elements.submitText) return;
        elements.submitButton.disabled = isLoading;
        elements.submitButton.classList.toggle('register-submit-loading', isLoading);
        elements.submitText.textContent = isLoading
            ? 'Creating account...'
            : 'Continue to secure checkout — 7 days free';
        elements.emailInput.disabled = isLoading;
        elements.passwordInput.disabled = isLoading;
        elements.confirmInput.disabled = isLoading;
    }

    function wirePasswordToggle(toggleId, fieldId, showLabel, hideLabel) {
        document.getElementById(toggleId)?.addEventListener('click', function () {
            var field = document.getElementById(fieldId);
            if (!field) return;
            var isPassword = field.type === 'password';
            field.type = isPassword ? 'text' : 'password';
            this.textContent = isPassword ? 'Hide' : 'Show';
            this.setAttribute('aria-label', isPassword ? hideLabel : showLabel);
        });
    }

    function initPlanVisualState() {
        function updatePlanVisualState() {
            var selectedPlan = document.querySelector('input[name="lbj-plan"]:checked')?.value;
            document.querySelectorAll('label.plan-selector-option').forEach(function (option) {
                var input = option.querySelector('input[name="lbj-plan"]');
                if (!input) return;
                option.classList.toggle('selected', input.value === selectedPlan);
            });
        }

        document.querySelectorAll('input[name="lbj-plan"]').forEach(function (input) {
            input.addEventListener('change', updatePlanVisualState);
        });

        var qs = new URLSearchParams(window.location.search);
        var plan = qs.get('plan');
        if (plan) {
            var planInput = document.getElementById('lbj-plan-' + plan);
            if (planInput) planInput.checked = true;
        }

        updatePlanVisualState();
    }

    document.addEventListener('DOMContentLoaded', function () {
        var shared = window.JuniorSignupShared;
        if (!shared) return;

        var form = document.getElementById('lbj-inline-signup-form');
        if (!form) return;

        var emailInput = document.getElementById('lbj-inline-email');
        var passwordInput = document.getElementById('lbj-inline-password');
        var confirmInput = document.getElementById('lbj-inline-password-confirm');
        var termsInput = document.getElementById('lbj-inline-terms');
        var submitButton = document.getElementById('lbj-inline-submit');
        var submitText = document.getElementById('lbj-inline-submit-text');
        var statusEl = document.getElementById('lbj-inline-status');
        var errorEl = document.getElementById('lbj-inline-error');
        var fieldRefs = { submitButton: submitButton, submitText: submitText, emailInput: emailInput, passwordInput: passwordInput, confirmInput: confirmInput };

        if (!emailInput || !passwordInput || !confirmInput || !termsInput || !submitButton || !submitText || !statusEl || !errorEl) {
            return;
        }

        wirePasswordToggle('lbj-inline-password-toggle', 'lbj-inline-password', 'Show password', 'Hide password');
        wirePasswordToggle('lbj-inline-password-confirm-toggle', 'lbj-inline-password-confirm', 'Show confirm password', 'Hide confirm password');
        initPlanVisualState();
        safeTrack('landing_jobs_inline_signup_view', { placement: 'hero' });

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            clearStatus(statusEl, errorEl);
            safeTrack('landing_jobs_inline_submit_clicked', { placement: 'hero' });

            var email = emailInput.value.trim();
            var password = passwordInput.value;
            var passwordConfirm = confirmInput.value;
            var termsAccepted = termsInput.checked === true;
            var selectedPlan = document.querySelector('input[name="lbj-plan"]:checked');
            var validationError = shared.validateRegistrationForm(email, password, passwordConfirm, termsAccepted, selectedPlan);

            if (validationError) {
                showStatus(errorEl, validationError, true);
                showValidationFeedback(validationError, {
                    emailInput: emailInput,
                    passwordInput: passwordInput,
                    confirmInput: confirmInput,
                    termsInput: termsInput
                });
                safeTrack('landing_jobs_inline_register_error', { reason: 'validation' });
                return;
            }

            clearFieldValidity([emailInput, passwordInput, confirmInput, termsInput]);

            setLoadingState(fieldRefs, true);

            try {
                var urlParams = new URLSearchParams(window.location.search);
                var couponFromUrl = urlParams.get('coupon');
                var couponCode = couponFromUrl
                    ? couponFromUrl.trim().toUpperCase()
                    : (sessionStorage.getItem('appliedCoupon') || null);
                var cancelUrl = window.location.origin + '/linkedin-basics-jobs.html' + window.location.search;
                var data = await shared.submitRegistrationRequest({
                    email: email,
                    password: password,
                    selectedPlanKey: selectedPlan.value,
                    couponCode: couponCode || null,
                    successUrl: window.location.origin + '/success.html',
                    cancelUrl: cancelUrl
                });

                var userId = shared.persistRegistrationSession(data, email);
                safeTrack('landing_jobs_inline_register_completed', { userId: userId });
                safeTrack('landing_jobs_inline_checkout_redirect', { sessionId: data.session_id || null });
                safeTrack('landing_jobs_inline_redirect_to_checkout');
                submitText.textContent = 'Redirecting to secure checkout...';
                showStatus(statusEl, 'Redirecting to secure checkout...', false);
                window.location.href = data.checkout_url;
            } catch (error) {
                if (error && error.type === 'duplicate_email') {
                    showDuplicateEmailError(errorEl);
                    safeTrack('landing_jobs_inline_register_error', { reason: 'duplicate_email' });
                } else if (error && error.name === 'AbortError') {
                    showStatus(errorEl, 'Our server is slow right now. Please try again — it usually works on the second attempt.', true);
                    safeTrack('landing_jobs_inline_register_error', { reason: 'timeout' });
                } else if (error instanceof TypeError) {
                    showStatus(errorEl, "Can't reach the server. Please check your internet connection.", true);
                    safeTrack('landing_jobs_inline_register_error', { reason: 'network' });
                } else {
                    showStatus(errorEl, (error && error.message) || 'Something went wrong. Please try again.', true);
                    safeTrack('landing_jobs_inline_register_error', { reason: 'server' });
                }
                setLoadingState(fieldRefs, false);
            }
        });
    });
})();
