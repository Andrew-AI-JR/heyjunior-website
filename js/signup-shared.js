(function () {
    var DEFAULT_SIGNUP_PLAN_PRICE_IDS = {
        basic: 'price_1TcWzqRxE6F23RwQ7FnKpQyU',
        starter: 'price_1TqD2LRxE6F23RwQg0S18fTb',
        standard: 'price_1RJMCrRxE6F23RwQEnHUwvFq',
        pro: 'price_1SX1LrRxE6F23RwQgWgIV1NK',
        enterprise: 'price_1U9pPSRxE6F23RwQnxbshVb5'
    };

    function getApiBaseUrl() {
        if (typeof window.getApiBaseUrl === 'function') {
            return window.getApiBaseUrl();
        }
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:8001';
        }
        return 'https://api.heyjunior.ai';
    }

    function getSignupPriceIds() {
        return window.JUNIOR_PRICING ? window.JUNIOR_PRICING.STRIPE_PRICE_IDS : DEFAULT_SIGNUP_PLAN_PRICE_IDS;
    }

    function validateEmail(email) {
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function validateRegistrationForm(email, password, passwordConfirm, termsAccepted, selectedPlan) {
        if (!email || !validateEmail(email)) {
            return 'Please enter a valid email address.';
        }

        if (!selectedPlan || !getSignupPriceIds()[selectedPlan.value]) {
            return 'Please select a subscription plan.';
        }

        if (!password || password.length < 8) {
            return 'Password must be at least 8 characters long.';
        }

        if (!password.match(/[A-Z]/)) {
            return 'Password must contain at least one uppercase letter.';
        }

        // Confirmation is optional: the one-screen register form uses a show/hide
        // toggle instead of a second password field (pass null to skip).
        if (passwordConfirm !== null && passwordConfirm !== undefined) {
            if (!passwordConfirm) {
                return 'Please confirm your password.';
            }

            if (password !== passwordConfirm) {
                return 'Passwords do not match. Please try again.';
            }
        }

        if (!termsAccepted) {
            return 'You must agree to the Terms of Service to continue.';
        }

        return null;
    }

    async function parseResponseBody(response) {
        var contentType = response.headers.get('content-type');
        if (contentType && contentType.indexOf('application/json') !== -1) {
            return response.json();
        }

        await response.text();
        throw {
            type: 'server',
            status: response.status,
            message: 'Something went wrong on our end. Please try again in a moment.'
        };
    }

    function buildErrorMessage(data) {
        if (!data) return 'Registration failed. Please try again.';

        if (data.detail) {
            if (Array.isArray(data.detail)) {
                return data.detail.map(function (err) {
                    return err.msg || err.message || 'Validation error';
                }).join('. ');
            }
            if (typeof data.detail === 'string') {
                return data.detail;
            }
            return data.detail.message || JSON.stringify(data.detail);
        }

        if (data.message) {
            return data.message;
        }

        return 'Registration failed. Please try again.';
    }

    async function submitRegistrationRequest(options) {
        var selectedPlanKey = options.selectedPlanKey;
        var priceId = getSignupPriceIds()[selectedPlanKey];
        if (!priceId) {
            throw {
                type: 'validation',
                message: 'Please select a subscription plan.'
            };
        }

        var requestBody = {
            email: options.email,
            password: options.password,
            price_id: priceId,
            success_url: options.successUrl || (window.location.origin + '/success.html'),
            cancel_url: options.cancelUrl || (window.location.origin + '/register.html' + window.location.search)
        };

        if (options.referralCode) {
            requestBody.referral_code = options.referralCode.toUpperCase();
        }
        if (options.couponCode) {
            requestBody.coupon_code = options.couponCode;
        }
        if (options.attribution) {
            requestBody.attribution = options.attribution;
        }

        var response = await fetch(getApiBaseUrl() + '/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        var data = await parseResponseBody(response);

        if (!response.ok) {
            var errorMessage = buildErrorMessage(data);
            var lowered = errorMessage.toLowerCase();
            if (response.status === 409 || lowered.indexOf('already exists') !== -1 || lowered.indexOf('already registered') !== -1) {
                throw {
                    type: 'duplicate_email',
                    status: response.status,
                    message: errorMessage
                };
            }

            if (response.status >= 500) {
                throw {
                    type: 'server',
                    status: response.status,
                    message: 'Something went wrong on our end. Please try again in a moment.'
                };
            }

            throw {
                type: response.status === 429 ? 'rate_limited' : 'rejected',
                status: response.status,
                message: response.status === 429
                    ? 'Too many attempts. Please wait a minute and try again.'
                    : errorMessage
            };
        }

        if (!data.checkout_url) {
            throw {
                type: 'no_checkout_url',
                status: response.status,
                message: 'Unable to start secure checkout. Please try again.'
            };
        }

        return data;
    }

    function persistRegistrationSession(data, email) {
        var accessToken = data.access_token || data.token;
        if (accessToken) {
            sessionStorage.setItem('userToken', accessToken);
            sessionStorage.setItem('accessToken', accessToken);
        }
        if (data.refresh_token) {
            sessionStorage.setItem('refreshToken', data.refresh_token);
        }
        var userId = data.id || data.user_id;
        if (userId) {
            sessionStorage.setItem('userId', userId.toString());
            sessionStorage.setItem('userEmail', data.email || email);
        }
        return userId || null;
    }

    window.JuniorSignupShared = {
        getSignupPriceIds: getSignupPriceIds,
        validateEmail: validateEmail,
        validateRegistrationForm: validateRegistrationForm,
        submitRegistrationRequest: submitRegistrationRequest,
        persistRegistrationSession: persistRegistrationSession
    };
})();
