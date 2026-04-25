/* register.js - User Registration */

const API_BASE_URL = window.getApiBaseUrl();

let currentUserToken = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Register page loaded');

    if (window.juniorTrack) {
        window.juniorTrack('register_page_view');
    }

    document.getElementById('register-form')?.addEventListener('submit', handleRegistration);

    document.getElementById('password-toggle')?.addEventListener('click', function () {
        const field = document.getElementById('reg-password');
        if (!field) return;
        const isPassword = field.type === 'password';
        field.type = isPassword ? 'text' : 'password';
        this.textContent = isPassword ? 'Hide' : 'Show';
        this.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });

    initInstantCommentDemo();
    loadReferralCode();
});

function initInstantCommentDemo() {
    const demoButton = document.getElementById('register-demo-button');
    const demoInput = document.getElementById('register-demo-input');
    const demoResult = document.getElementById('register-demo-result');
    const signupGate = document.getElementById('register-signup-gate');

    if (!demoButton || !demoInput || !demoResult || !signupGate) return;

    demoButton.addEventListener('click', function () {
        const hadInput = demoInput.value.trim().length > 0;

        if (!hadInput) {
            demoInput.value = "We're hiring for an AI engineer who can build reliable systems, improve model performance, and work across product and engineering teams.";
        }

        demoResult.hidden = false;
        signupGate.hidden = false;
        demoButton.textContent = 'Generated';
        demoButton.disabled = true;

        if (window.juniorTrack) {
            window.juniorTrack('register_demo_generated', {
                source: hadInput ? 'user_input' : 'sample'
            });
        }

        demoResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function loadReferralCode() {
    // Get referral code from storage (stored for 30 days)
    const referralCode = window.getReferralCode ? window.getReferralCode() : localStorage.getItem('referralCode');
    
    if (referralCode) {
        // Check if referral is still valid (within 30 days)
        const refTimestamp = localStorage.getItem('referralTimestamp');
        if (refTimestamp) {
            const daysSinceRef = (Date.now() - parseInt(refTimestamp)) / (1000 * 60 * 60 * 24);
            if (daysSinceRef <= 30) {
                // Store in hidden field for form submission
                document.getElementById('referral-code-field').value = referralCode.toUpperCase();
                console.log('Referral code loaded from storage:', referralCode);
            } else {
                // Referral expired, clear it
                localStorage.removeItem('referralCode');
                localStorage.removeItem('referralTimestamp');
                console.log('Referral code expired, cleared');
            }
        } else {
            // No timestamp, but code exists - use it
            document.getElementById('referral-code-field').value = referralCode.toUpperCase();
            console.log('Referral code loaded from storage:', referralCode);
        }
    }
}

async function handleRegistration(e) {
    e.preventDefault();

    if (window.juniorTrack) {
        window.juniorTrack('register_submit_clicked');
    }

    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const termsAccepted = document.getElementById('terms-agree-register')?.checked === true;
    const registerButton = document.getElementById('register-button');
    const registerButtonText = document.getElementById('register-button-text');
    const registerStatus = document.getElementById('register-status');
    const registerError = document.getElementById('register-error');

    clearStatus(registerStatus, registerError);

    const validationError = validateRegistrationForm(email, password, termsAccepted);
    if (validationError) {
        showError(registerError, validationError);
        if (window.juniorTrack) {
            window.juniorTrack('register_submit_error', { reason: 'validation' });
        }
        return;
    }

    registerButton.disabled = true;
    registerButton.classList.add('register-submit-loading');
    registerButtonText.textContent = 'Creating account...';
    document.getElementById('reg-email').disabled = true;
    document.getElementById('reg-password').disabled = true;
    console.log('[Register] registration request started');

    const abortController = new AbortController();
    const timeoutId = setTimeout(function () {
        abortController.abort();
    }, 12000);

    try {
        const referralCode = document.getElementById('referral-code-field').value;

        const requestBody = { email: email, password: password };
        if (referralCode) {
            requestBody.referral_code = referralCode.toUpperCase();
            console.log('[Register] including referral code:', referralCode);
        }

        const response = await fetch(API_BASE_URL + '/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        });

        clearTimeout(timeoutId);
        console.log('[Register] registration response received, status:', response.status);
        
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('[Register] non-JSON response:', text);
            throw new Error(text || 'Registration failed. Please try again.');
        }

        if (!response.ok) {
            console.log('[Register] registration failed:', response.status, data);
            let errorMessage = 'Registration failed. Please try again.';
            if (data.detail) {
                if (Array.isArray(data.detail)) {
                    errorMessage = data.detail.map(function (err) { return err.msg || err.message || 'Validation error'; }).join('. ');
                } else if (typeof data.detail === 'string') {
                    errorMessage = data.detail;
                } else {
                    errorMessage = data.detail.message || JSON.stringify(data.detail);
                }
            } else if (data.message) {
                errorMessage = data.message;
            }
            
            if (response.status === 409 || errorMessage.toLowerCase().includes('already exists')) {
                showDuplicateEmailError(registerError);
                if (window.juniorTrack) {
                    window.juniorTrack('register_submit_error', { reason: 'duplicate_email' });
                }
                registerButton.disabled = false;
                registerButton.classList.remove('register-submit-loading');
                registerButtonText.textContent = 'Create My Account & Get More';
                document.getElementById('reg-email').disabled = false;
                document.getElementById('reg-password').disabled = false;
                return;
            }

            if (response.status >= 500) {
                errorMessage = 'Something went wrong on our end. Please try again in a moment.';
            }

            throw new Error(errorMessage);
        }

        console.log('[Register] registration success:', data);
        registerButtonText.textContent = 'Account created. Redirecting...';
        showSuccess(registerStatus, 'Account created. Redirecting...');
        
        if (data.id) {
            sessionStorage.setItem('userId', data.id.toString());
            sessionStorage.setItem('userEmail', data.email || email);
        }

        if (window.juniorTrack) {
            window.juniorTrack('register_submit_success', { userId: data.id || null });
            window.juniorTrack('register_completed', { userId: data.id || null });
        }

        if (referralCode) {
            localStorage.removeItem('referralCode');
            localStorage.removeItem('referralTimestamp');
        }

        autoLoginAfterRegister(email, password);

        console.log('[Register] redirecting to portal in 1s');
        setTimeout(function () {
            if (window.juniorTrack) {
                window.juniorTrack('register_redirect_to_portal');
            }
            window.location.href = 'portal.html';
        }, 1000);

    } catch (error) {
        clearTimeout(timeoutId);

        let msg;
        if (error.name === 'AbortError') {
            msg = 'Registration is taking too long. Please check your connection and try again.';
            console.error('[Register] registration request timed out');
            if (window.juniorTrack) {
                window.juniorTrack('register_timeout');
                window.juniorTrack('register_submit_error', { reason: 'timeout' });
            }
        } else if (error instanceof TypeError) {
            msg = "Can't reach the server. Please check your internet connection.";
            console.error('[Register] network error:', error);
            if (window.juniorTrack) {
                window.juniorTrack('register_submit_error', { reason: 'network' });
            }
        } else {
            msg = error.message || 'Something went wrong. Please try again.';
            console.error('[Register] registration error:', error);
            if (window.juniorTrack) {
                window.juniorTrack('register_submit_error', { reason: 'server' });
            }
        }

        showErrorWithLoginFallback(registerError, msg);
        registerButton.disabled = false;
        registerButton.classList.remove('register-submit-loading');
        registerButtonText.textContent = 'Create My Account & Get More';
        document.getElementById('reg-email').disabled = false;
        document.getElementById('reg-password').disabled = false;
    }
}

function autoLoginAfterRegister(email, password) {
    console.log('[Register] auto-login started (fire-and-forget)');
    fetch(API_BASE_URL + '/api/users/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: email, password: password })
    }).then(function (resp) {
        if (!resp.ok) throw new Error('login response ' + resp.status);
        return resp.json();
    }).then(function (loginData) {
        if (loginData.access_token) sessionStorage.setItem('userToken', loginData.access_token);
        if (loginData.refresh_token) sessionStorage.setItem('refreshToken', loginData.refresh_token);
        console.log('[Register] auto-login success');
    }).catch(function (err) {
        console.warn('[Register] auto-login failed (non-fatal):', err.message);
    });
}

function validateRegistrationForm(email, password, termsAccepted) {
    if (!email || !validateEmail(email)) {
        return 'Please enter a valid email address.';
    }
    
    if (!password || password.length < 8) {
        return 'Password must be at least 8 characters long.';
    }
    
    // Check for uppercase letter requirement
    if (!password.match(/[A-Z]/)) {
        return 'Password must contain at least one uppercase letter.';
    }

    if (!termsAccepted) {
        return 'You must agree to the Terms of Service to continue.';
    }
    
    return null;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function clearStatus(successEl, errorEl) {
    if (successEl) {
        successEl.hidden = true;
        successEl.textContent = '';
    }
    if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
        errorEl.innerHTML = '';
    }
}

function showSuccess(element, message) {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.classList.remove('register-status-error');
    element.classList.add('register-status-success');
}

function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.classList.remove('register-status-success');
    element.classList.add('register-status-error');
}

function showErrorWithLoginFallback(element, message) {
    if (!element) return;
    element.hidden = false;
    element.classList.remove('register-status-success');
    element.classList.add('register-status-error');

    var msg = document.createElement('span');
    msg.textContent = message + ' ';

    var fallback = document.createElement('span');
    fallback.textContent = 'Already tried before? ';

    var link = document.createElement('a');
    link.href = 'portal.html';
    link.textContent = 'Log in here';

    fallback.appendChild(link);
    fallback.appendChild(document.createTextNode('.'));

    element.appendChild(msg);
    element.appendChild(fallback);
}

function showDuplicateEmailError(element) {
    if (!element) return;
    element.hidden = false;
    element.classList.remove('register-status-success');
    element.classList.add('register-status-error');

    const intro = document.createElement('span');
    intro.textContent = 'Looks like you already have an account. ';

    const login = document.createElement('a');
    login.href = 'portal.html';
    login.textContent = 'Log in here';

    const separator = document.createTextNode(' or ');

    const forgot = document.createElement('a');
    forgot.href = 'forgot-password.html';
    forgot.textContent = 'reset your password';

    element.appendChild(intro);
    element.appendChild(login);
    element.appendChild(separator);
    element.appendChild(forgot);
    element.appendChild(document.createTextNode('.'));
}

