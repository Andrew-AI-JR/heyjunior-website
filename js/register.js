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

    initEmailStep();

    var qs = new URLSearchParams(window.location.search);
    var src = qs.get('src') || sessionStorage.getItem('marketingSource') || '';
    var isRedditFlow = src.indexOf('reddit') !== -1;

    if (isRedditFlow) {
        initInstantCommentDemo();
    } else {
        skipDemoShowSignup();
    }

    loadReferralCode();
});

function skipDemoShowSignup() {
    var hook = document.getElementById('register-hook');
    var directHook = document.getElementById('register-direct-hook');
    var demo = document.getElementById('register-demo');
    var demoResult = document.getElementById('register-demo-result');
    var signupGate = document.getElementById('register-signup-gate');
    var emailStep = document.getElementById('email-step');
    var fullSignup = document.getElementById('full-signup-step');

    if (hook) hook.hidden = true;
    if (demo) demo.hidden = true;
    if (demoResult) demoResult.hidden = true;
    if (directHook) directHook.hidden = false;

    if (signupGate) signupGate.hidden = false;
    if (emailStep) emailStep.hidden = false;
    if (fullSignup) fullSignup.hidden = true;
}

function initEmailStep() {
    const emailStepBtn = document.getElementById('email-step-button');
    const emailStepInput = document.getElementById('email-step-input');
    const emailStepDiv = document.getElementById('email-step');
    const fullSignupDiv = document.getElementById('full-signup-step');
    const regEmail = document.getElementById('reg-email');

    if (!emailStepBtn || !emailStepInput || !emailStepDiv || !fullSignupDiv || !regEmail) return;

    const storedEmail = sessionStorage.getItem('juniorCapturedEmail');
    if (storedEmail) {
        emailStepInput.value = storedEmail;
    }

    emailStepBtn.addEventListener('click', function () {
        const email = emailStepInput.value.trim();
        if (!email || !validateEmail(email)) {
            emailStepInput.setCustomValidity('Please enter a valid email address.');
            emailStepInput.reportValidity();
            return;
        }

        emailStepInput.setCustomValidity('');
        sessionStorage.setItem('juniorCapturedEmail', email);
        regEmail.value = email;

        if (window.juniorTrack) {
            window.juniorTrack('register_email_captured');
        }

        emailStepDiv.hidden = true;
        fullSignupDiv.hidden = false;

        if (window.juniorTrack) {
            window.juniorTrack('register_signup_revealed');
        }

        document.getElementById('reg-password')?.focus();
    });
}

function initInstantCommentDemo() {
    const demoButton = document.getElementById('register-demo-button');
    const backgroundInput = document.getElementById('register-demo-background');
    const postInput = document.getElementById('register-demo-post');
    const demoResult = document.getElementById('register-demo-result');
    const demoComment = document.getElementById('register-demo-comment');
    const demoNote = document.getElementById('register-demo-result-note');
    const demoError = document.getElementById('register-demo-error');
    const signupGate = document.getElementById('register-signup-gate');
    const fallbackComment = "Hey -- saw you're hiring for a data engineer. I've spent the last 5 years building and optimizing ETL pipelines in AWS, including improving data throughput in production systems. Would love to connect if you're still hiring.";

    if (!demoButton || !backgroundInput || !postInput || !demoResult || !demoComment || !signupGate) return;

    demoButton.addEventListener('click', async function () {
        if (demoError) {
            demoError.textContent = '';
            demoError.hidden = true;
        }

        const backgroundText = backgroundInput.value.trim();
        const postText = postInput.value.trim();

        if (!backgroundText) {
            showDemoError(demoError, 'Paste a short background first so Junior can personalize the comment.');
            backgroundInput.focus();
            return;
        }

        if (backgroundText.length < 20) {
            showDemoError(demoError, 'Add a little more about your background so Junior has enough to work with.');
            backgroundInput.focus();
            return;
        }

        if (!postText) {
            showDemoError(demoError, 'Paste a hiring post first.');
            postInput.focus();
            return;
        }

        if (postText.length < 20) {
            showDemoError(demoError, 'Paste a little more of the post so Junior has enough context.');
            postInput.focus();
            return;
        }

        demoButton.disabled = true;
        demoButton.textContent = 'Generating...';

        const combinedContext = "User background:\n" + backgroundText + "\n\nHiring post:\n" + postText;
        const demoTimeoutMs = 4000;

        if (window.juniorTrack) {
            window.juniorTrack('register_demo_generate_clicked', { source: 'register-personalized-demo' });
        }

        const abortController = new AbortController();
        const timeoutId = setTimeout(function () { abortController.abort(); }, demoTimeoutMs);

        try {
            const response = await fetch(API_BASE_URL + '/api/comments/demo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_text: combinedContext,
                    user_bio: backgroundText,
                    hiring_post: postText,
                    context_text: combinedContext,
                    source: 'register-personalized-demo'
                }),
                signal: abortController.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error('Demo generation failed');
            }

            const data = await response.json();
            const isFallback = Boolean(data && data.fallback);
            showRegisterDemoResult(
                demoResult,
                signupGate,
                demoComment,
                demoNote,
                data && data.comment ? data.comment : fallbackComment,
                isFallback
            );

            if (window.juniorTrack) {
                window.juniorTrack(isFallback ? 'register_demo_fallback_shown' : 'register_demo_result_shown', {
                    source: 'register-personalized-demo'
                });
            }
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('[Register demo] generation failed:', error);
            showRegisterDemoResult(demoResult, signupGate, demoComment, demoNote, fallbackComment, true);

            if (window.juniorTrack) {
                window.juniorTrack('register_demo_fallback_shown', {
                    source: 'register-personalized-demo',
                    reason: error && error.name === 'AbortError' ? 'timeout' : 'network'
                });
            }
        } finally {
            demoButton.disabled = false;
            demoButton.textContent = 'Generate My Personalized Comment';
        }
    });
}

function showDemoError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
}

function showRegisterDemoResult(resultEl, signupGateEl, commentEl, noteEl, comment, fallback) {
    commentEl.textContent = comment;
    if (noteEl) {
        noteEl.textContent = fallback
            ? 'This is an example. Create an account to generate comments from your exact background and posts.'
            : 'This was generated from your background and the post above.';
    }
    resultEl.hidden = false;
    signupGateEl.hidden = false;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    }, 30000);

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
            msg = 'Registration is taking longer than expected. Please try again in a moment.';
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

