(function () {
    var DEFAULT_SIGNUP_PLAN_PRICE_IDS = {
        basic: 'price_1TcWzqRxE6F23RwQ7FnKpQyU',
        starter: 'price_1TqD2LRxE6F23RwQg0S18fTb',
        standard: 'price_1RJMCrRxE6F23RwQEnHUwvFq',
        pro: 'price_1SX1LrRxE6F23RwQgWgIV1NK'
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

        if (!passwordConfirm) {
            return 'Please confirm your password.';
        }

        if (password !== passwordConfirm) {
            return 'Passwords do not match. Please try again.';
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

        var text = await response.text();
        throw {
            type: 'server',
            message: text || 'Registration failed. Please try again.'
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

        var response = await fetch(getApiBaseUrl() + '/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        var data = await parseResponseBody(response);

        if (!response.ok) {
            var errorMessage = buildErrorMessage(data);
            if (response.status === 409 || errorMessage.toLowerCase().indexOf('already exists') !== -1) {
                throw {
                    type: 'duplicate_email',
                    message: errorMessage
                };
            }

            if (response.status >= 500) {
                throw {
                    type: 'server',
                    message: 'Something went wrong on our end. Please try again in a moment.'
                };
            }

            throw {
                type: 'server',
                message: errorMessage
            };
        }

        if (!data.checkout_url) {
            throw {
                type: 'server',
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
