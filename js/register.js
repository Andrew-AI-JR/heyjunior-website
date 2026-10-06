/* register.js - User Registration */

const API_BASE_URL = window.getApiBaseUrl();
const signupShared = window.JuniorSignupShared || null;

function getSignupPriceIds() {
    if (signupShared && typeof signupShared.getSignupPriceIds === 'function') {
        return signupShared.getSignupPriceIds();
    }
    return window.JUNIOR_PRICING ? window.JUNIOR_PRICING.STRIPE_PRICE_IDS : {};
}

let currentUserToken = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Register page loaded');

    if (window.juniorTrack) {
        window.juniorTrack('register_page_view');
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('cancelled') === 'true') {
        const cancelledBanner = document.getElementById('cancelled-banner');
        if (cancelledBanner) cancelledBanner.hidden = false;
        if (window.juniorTrack) {
            window.juniorTrack('register_checkout_cancelled');
        }
    }

    document.getElementById('register-form')?.addEventListener('submit', handleRegistration);

    function wirePasswordToggle(toggleId, fieldId, showLabel, hideLabel) {
        document.getElementById(toggleId)?.addEventListener('click', function () {
            const field = document.getElementById(fieldId);
            if (!field) return;
            const isPassword = field.type === 'password';
            field.type = isPassword ? 'text' : 'password';
            this.textContent = isPassword ? 'Hide' : 'Show';
            this.setAttribute('aria-label', isPassword ? hideLabel : showLabel);
        });
    }
    wirePasswordToggle('password-toggle', 'reg-password', 'Show password', 'Hide password');

    var qs = new URLSearchParams(window.location.search);
    var src = qs.get('src') || sessionStorage.getItem('marketingSource') || '';
    if (src) {
        sessionStorage.setItem('marketingSource', src);
    }
    var isRedditFlow = src.indexOf('reddit') !== -1;
    var audience = getSignupAudience(src, qs);
    var identity = getPostingIdentity(qs, audience);
    try {
        sessionStorage.setItem('juniorPostingIdentity', identity);
    } catch (e) {
        // Storage is a convenience only.
    }

    if (isRedditFlow) {
        // Reddit traffic sees the instant comment demo first; the one-screen
        // signup form appears under the generated comment.
        initInstantCommentDemo();
    } else {
        skipDemoShowSignup(audience, identity);
    }
    initEmailCapture();

    applyTryItSignupHandoff(src, qs);
    loadReferralCode();
    
    // Plan: the URL wins; otherwise Enterprise when posting as a company page,
    // Basic for job seekers (the advertised $9.99 entry price) and Standard for
    // other individuals.
    var plan = (qs.get('plan') || '').toLowerCase();
    var basicOption = document.getElementById('reg-plan-basic-option');
    if (basicOption && (audience === 'jobseeker' || plan === 'basic')) {
        basicOption.hidden = false;
    }
    var planInput = plan ? document.getElementById('reg-plan-' + plan) : null;
    if (!planInput) {
        var defaultPlan = 'reg-plan-enterprise';
        if (audience === 'jobseeker') defaultPlan = 'reg-plan-basic';
        else if (identity === 'personal') defaultPlan = 'reg-plan-standard';
        planInput = document.getElementById(defaultPlan);
    }
    if (planInput) {
        planInput.checked = true;
    }

    // Handle plan selection visual state
    const planInputs = document.querySelectorAll('input[name="reg-plan"]');
    if (planInputs.length > 0) {
        function updatePlanVisualState() {
            const selectedPlan = document.querySelector('input[name="reg-plan"]:checked')?.value;
            document.querySelectorAll('.plan-selector-option').forEach(option => {
                const input = option.querySelector('input[name="reg-plan"]');
                if (input) {
                    if (input.value === selectedPlan) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                }
            });
        }
        
        planInputs.forEach(input => {
            input.addEventListener('change', updatePlanVisualState);
            input.addEventListener('change', updateTrialCopy);
        });
        
        // Initial state
        updatePlanVisualState();
        updateTrialCopy();
    }

    document.getElementById('register-change-plan')?.addEventListener('click', function () {
        var selection = document.getElementById('register-plan-selection');
        if (!selection) return;
        var opening = selection.hidden;
        selection.hidden = !opening;
        this.setAttribute('aria-expanded', opening ? 'true' : 'false');
        this.textContent = opening ? 'Done' : 'Change plan';
        if (opening) {
            selection.querySelector('input[name="reg-plan"]:checked')?.focus();
            if (window.juniorTrack) window.juniorTrack('register_change_plan_opened');
        }
    });
});

function applyTryItSignupHandoff(src, qs) {
    if (!src || (src.indexOf('tryit') === -1 && src.indexOf('demo') === -1)) return;

    var storedBio = sessionStorage.getItem('juniorTryItUserBio');
    var backgroundInput = document.getElementById('register-demo-background');
    if (storedBio && backgroundInput) {
        backgroundInput.value = storedBio;
    }

    // Older demo links carried the suggested angle in the URL; keep it in the
    // session and remove it from the address bar so it is never logged or shared.
    var angleFromQuery = qs.get('angle');
    if (angleFromQuery) {
        sessionStorage.setItem('juniorTryItSuggestedAngle', angleFromQuery);
        qs.delete('angle');
        var cleanSearch = qs.toString();
        history.replaceState(null, '', window.location.pathname + (cleanSearch ? '?' + cleanSearch : '') + window.location.hash);
    }
}

function getSignupAudience(src, qs) {
    var explicit = (qs.get('audience') || '').toLowerCase();
    if (explicit === 'jobseeker' || explicit === 'company') return explicit;
    var plan = (qs.get('plan') || '').toLowerCase();
    if (plan === 'basic') return 'jobseeker';
    // Legacy links without audience=; new CTAs always pass it explicitly.
    var s = (src || '').toLowerCase();
    if (/(job|reddit|basics|career|layoff|seeker|resume|hiring|partners-|applying|linkedin-visibility)/.test(s)) return 'jobseeker';
    return 'company';
}

function getPostingIdentity(qs, audience) {
    var explicit = (qs.get('identity') || '').toLowerCase();
    if (explicit === 'personal' || explicit === 'company') return explicit;
    var plan = (qs.get('plan') || '').toLowerCase();
    if (plan === 'enterprise') return 'company';
    if (plan || audience === 'jobseeker') return 'personal';
    return 'company';
}

function getPlanTrialDays(planKey) {
    var plans = window.JUNIOR_PRICING && window.JUNIOR_PRICING.PLANS;
    if (plans && plans[planKey] && plans[planKey].trialDays) return plans[planKey].trialDays;
    return 14;
}

function formatPlanPrice(planInfo) {
    if (!planInfo) return '';
    return '$' + (planInfo.price % 1 === 0 ? planInfo.price : planInfo.price.toFixed(2)) + '/month';
}

function attributionValue(value) {
    if (!value) return null;
    var cleaned = String(value).replace(/[^A-Za-z0-9_\-./]/g, '-').slice(0, 80);
    return cleaned || null;
}

// Only Enterprise can comment as a company page, so the plan chosen at submit wins over the landing link.
function syncPostingIdentity(planKey) {
    var explicit = (new URLSearchParams(window.location.search).get('identity') || '').toLowerCase();
    var identity = planKey === 'enterprise' && explicit !== 'personal' ? 'company' : 'personal';
    try {
        sessionStorage.setItem('juniorPostingIdentity', identity);
    } catch (e) {
        // Storage is a convenience only.
    }
}

function buildSignupAttribution() {
    var read = function (storage, key) {
        try {
            return storage.getItem(key);
        } catch (e) {
            return null;
        }
    };
    return {
        first_touch_source: attributionValue(read(localStorage, 'juniorFirstTouchSource')),
        cta_placement: attributionValue(read(sessionStorage, 'marketingSource')),
        landing_path: attributionValue(read(localStorage, 'juniorFirstTouchPath')),
        posting_identity: read(sessionStorage, 'juniorPostingIdentity')
    };
}

function getSubmitLabel() {
    var selected = document.querySelector('input[name="reg-plan"]:checked');
    if (!selected) return 'Continue to secure checkout';
    return 'Continue to secure checkout \u00b7 ' + getPlanTrialDays(selected.value) + ' days free';
}

function updateTrialCopy() {
    var selected = document.querySelector('input[name="reg-plan"]:checked');
    var buttonText = document.getElementById('register-button-text');
    var terms = document.getElementById('register-trial-terms');
    if (buttonText && !document.getElementById('register-button')?.disabled) {
        buttonText.textContent = getSubmitLabel();
    }
    if (!selected || !terms) return;
    var plans = window.JUNIOR_PRICING && window.JUNIOR_PRICING.PLANS;
    var planInfo = plans && plans[selected.value];
    var days = getPlanTrialDays(selected.value);
    var start = new Date();
    start.setDate(start.getDate() + days);
    var startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var price = formatPlanPrice(planInfo) || 'your plan';
    // Estimated from today; Stripe sets the authoritative date at checkout.
    terms.textContent = '$0 today. ' + days + ' days free, then ' + price + ' from about ' + startLabel + ' unless you cancel.';
    updatePlanSummary(selected, planInfo, days);
}

function updatePlanSummary(selected, planInfo, days) {
    var name = document.getElementById('register-summary-plan');
    var price = document.getElementById('register-summary-price');
    var scope = document.getElementById('register-summary-scope');
    if (!name || !price || !scope) return;
    name.textContent = planInfo ? planInfo.label : selected.value;
    price.textContent = days + ' days free, then ' + (formatPlanPrice(planInfo) || 'your plan');
    var option = selected.closest('.plan-selector-option');
    var detail = option ? option.querySelector('small') : null;
    scope.textContent = detail ? detail.textContent : '';
}

function skipDemoShowSignup(audience, identity) {
    var hook = document.getElementById('register-hook');
    var directHook = document.getElementById('register-direct-hook');
    var demo = document.getElementById('register-demo');
    var demoResult = document.getElementById('register-demo-result');
    var signupGate = document.getElementById('register-signup-gate');

    if (hook) hook.hidden = true;
    if (demo) demo.hidden = true;
    if (demoResult) demoResult.hidden = true;
    if (directHook) directHook.hidden = false;
    if (signupGate) signupGate.hidden = false;

    var title = document.getElementById('register-direct-title');
    var sub = document.getElementById('register-direct-sub');
    if (audience === 'jobseeker') {
        if (title) title.textContent = 'Get 14 days free';
        if (sub) sub.textContent = 'Junior comments on hiring managers\u2019 and recruiters\u2019 LinkedIn posts in your voice, so the right people notice you before you apply.';
    } else if (identity === 'personal') {
        if (sub) sub.textContent = 'Junior comments on your buyers\u2019 LinkedIn posts as you, in your voice, and brings every reply into one inbox.';
    }
}

function saveSignupLead(email) {
    // Lets us send one "finish signing up" email if the account is never
    // created. Fire-and-forget: it must never slow down or block signup.
    try {
        var selected = document.querySelector('input[name="reg-plan"]:checked');
        var source = '';
        try {
            source = sessionStorage.getItem('marketingSource') || '';
        } catch (e) {
            source = '';
        }
        fetch(API_BASE_URL + '/api/users/signup-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                source: source || null,
                plan: selected ? selected.value : null
            }),
            keepalive: true
        }).catch(function () { /* ignore */ });
    } catch (e) {
        // Ignore: lead capture is optional.
    }
}

function initEmailCapture() {
    var regEmail = document.getElementById('reg-email');
    if (!regEmail) return;

    var storedEmail = null;
    try {
        storedEmail = sessionStorage.getItem('juniorCapturedEmail');
    } catch (e) {
        storedEmail = null;
    }
    if (storedEmail && !regEmail.value) {
        regEmail.value = storedEmail;
    }

    var tracked = false;
    regEmail.addEventListener('blur', function () {
        var email = regEmail.value.trim();
        if (!email || !validateEmail(email)) return;
        try {
            sessionStorage.setItem('juniorCapturedEmail', email);
        } catch (e) {
            // Storage is a convenience only.
        }
        if (!tracked) {
            tracked = true;
            if (window.juniorTrack) {
                window.juniorTrack('register_email_captured');
            }
            saveSignupLead(email);
        }
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

    if (!signupShared || typeof signupShared.submitRegistrationRequest !== 'function') {
        console.error('[Register] shared signup helpers are unavailable');
        const registerError = document.getElementById('register-error');
        showError(registerError, 'Signup is temporarily unavailable. Please refresh and try again.');
        return;
    }

    if (window.juniorTrack) {
        window.juniorTrack('register_submit_clicked');
    }

    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    // One-screen form: no confirm field (show/hide toggle instead) and terms are
    // accepted by the "By continuing you agree" statement next to the button.
    const passwordConfirm = null;
    const termsAccepted = true;
    const registerButton = document.getElementById('register-button');
    const registerButtonText = document.getElementById('register-button-text');
    const registerStatus = document.getElementById('register-status');
    const registerError = document.getElementById('register-error');

    clearStatus(registerStatus, registerError);

    const selectedPlan = document.querySelector('input[name="reg-plan"]:checked');
    const validationError = validateRegistrationForm(email, password, passwordConfirm, termsAccepted, selectedPlan);
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

    try {
        const referralCode = document.getElementById('referral-code-field').value;
        const selectedPlanKey = selectedPlan.value;
        syncPostingIdentity(selectedPlanKey);

        const urlParams = new URLSearchParams(window.location.search);
        const couponFromUrl = urlParams.get('coupon');
        const couponCode = couponFromUrl
            ? couponFromUrl.trim().toUpperCase()
            : (sessionStorage.getItem('appliedCoupon') || null);

        if (referralCode) {
            console.log('[Register] including referral code:', referralCode);
        }

        const data = await signupShared.submitRegistrationRequest({
            email: email,
            password: password,
            selectedPlanKey: selectedPlanKey,
            referralCode: referralCode || null,
            couponCode: couponCode || null,
            attribution: buildSignupAttribution(),
            successUrl: window.location.origin + '/success.html',
            cancelUrl: window.location.origin + '/register.html' + window.location.search
        });
        const userId = signupShared.persistRegistrationSession(data, email);
        console.log('[Register] registration success:', data);

        if (window.juniorTrack) {
            window.juniorTrack('register_completed', { userId: userId || null });
            window.juniorTrack('register_checkout_redirect', { sessionId: data.session_id || null });
        }

        if (referralCode) {
            localStorage.removeItem('referralCode');
            localStorage.removeItem('referralTimestamp');
        }

        registerButtonText.textContent = 'Redirecting to secure checkout...';
        showSuccess(registerStatus, 'Redirecting to secure checkout...');

        if (window.juniorTrack) {
            window.juniorTrack('register_redirect_to_checkout');
        }
        window.location.href = data.checkout_url;

    } catch (error) {
        let msg;
        if (error && error.type === 'duplicate_email') {
            showDuplicateEmailError(registerError);
            if (window.juniorTrack) {
                window.juniorTrack('register_submit_error', { reason: 'duplicate_email' });
            }
            registerButton.disabled = false;
            registerButton.classList.remove('register-submit-loading');
            registerButtonText.textContent = getSubmitLabel();
            document.getElementById('reg-email').disabled = false;
            document.getElementById('reg-password').disabled = false;
            return;
        } else if (error.name === 'AbortError') {
            msg = 'Our server is slow right now. Please try again — it usually works on the second attempt.';
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
            msg = (error && error.message) || 'Something went wrong. Please try again.';
            console.error('[Register] registration error:', error);
            if (window.juniorTrack) {
                window.juniorTrack('register_submit_error', {
                    reason: (error && error.type) || 'unknown',
                    status: (error && error.status) || null
                });
            }
        }

        showErrorWithLoginFallback(registerError, msg);
        registerButton.disabled = false;
        registerButton.classList.remove('register-submit-loading');
        registerButtonText.textContent = getSubmitLabel();
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

function validateRegistrationForm(email, password, passwordConfirm, termsAccepted, selectedPlan) {
    if (signupShared && typeof signupShared.validateRegistrationForm === 'function') {
        return signupShared.validateRegistrationForm(email, password, passwordConfirm, termsAccepted, selectedPlan);
    }
    return 'Unable to validate signup right now. Please refresh and try again.';
}

function validateEmail(email) {
    if (signupShared && typeof signupShared.validateEmail === 'function') {
        return signupShared.validateEmail(email);
    }
    return false;
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
    intro.textContent = 'This email already has a Junior account. ';

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

