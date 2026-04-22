/* register.js - User Registration */

const API_BASE_URL = window.getApiBaseUrl();

// Global variables
let currentUserToken = null;

function detectUserPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('win')) return 'windows';
    return 'windows';
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Register page loaded');
    
    // Initialize release manager if available
    if (typeof JuniorReleaseManager !== 'undefined') {
        window.juniorReleaseManager = new JuniorReleaseManager();
        console.log('Release manager initialized');
    }
    
    // Pre-select platform radio to match user's system
    const detected = detectUserPlatform();
    const radio = document.querySelector(`input[name="platform"][value="${detected}"]`);
    if (radio) {
        radio.checked = true;
    }
    
    // Setup form validation
    document.getElementById('reg-confirm-password')?.addEventListener('input', validatePasswordMatch);
    document.getElementById('reg-password')?.addEventListener('input', validatePasswordMatch);
    
    // Setup register button
    document.getElementById('register-button')?.addEventListener('click', handleRegistration);
    
    // Load referral code from storage (hidden field)
    loadReferralCode();
});

function validatePasswordMatch() {
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const confirmField = document.getElementById('reg-confirm-password');
    
    if (confirmPassword && password !== confirmPassword) {
        confirmField.setCustomValidity('Passwords do not match');
    } else {
        confirmField.setCustomValidity('');
    }
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
    
    var email = document.getElementById('reg-email').value.trim();
    var password = document.getElementById('reg-password').value;
    var confirmPassword = document.getElementById('reg-confirm-password').value;
    var termsAccepted = document.getElementById('terms-agree-register')?.checked === true;
    var registerButton = document.getElementById('register-button');
    var registerButtonText = document.getElementById('register-button-text');
    var registerError = document.getElementById('register-error');
    
    registerError.style.display = 'none';
    
    var validationError = validateRegistrationForm(email, password, confirmPassword, termsAccepted);
    if (validationError) {
        registerError.textContent = validationError;
        registerError.style.display = 'block';
        return;
    }
    
    registerButton.disabled = true;
    registerButtonText.textContent = 'Creating account...';
    console.log('[Register] registration request started');

    var abortController = new AbortController();
    var timeoutId = setTimeout(function () {
        abortController.abort();
    }, 12000);
    
    try {
        var referralCode = document.getElementById('referral-code-field').value;
        
        var requestBody = { email: email, password: password };
        if (referralCode) {
            requestBody.referral_code = referralCode.toUpperCase();
            console.log('[Register] including referral code:', referralCode);
        }
        
        var response = await fetch(API_BASE_URL + '/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        });

        clearTimeout(timeoutId);
        console.log('[Register] registration response received, status:', response.status);
        
        var contentType = response.headers.get('content-type');
        var data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            var text = await response.text();
            console.error('[Register] non-JSON response:', text);
            throw new Error(text || 'Registration failed. Please try again.');
        }
        
        if (!response.ok) {
            console.log('[Register] registration failed:', response.status, data);
            var errorMessage = 'Registration failed. Please try again.';
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
                errorMessage = 'An account with this email already exists. Please login instead.';
            }
            
            throw new Error(errorMessage);
        }
        
        // --- Account created. Everything below is success-path only. ---
        console.log('[Register] registration success:', data);
        registerButtonText.textContent = 'Account created. Redirecting...';
        
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

        // Auto-login is fire-and-forget. Do NOT await it before redirecting.
        autoLoginAfterRegister(email, password);

        // Redirect to portal immediately. Download happens there, not here.
        console.log('[Register] redirecting to portal in 1s');
        setTimeout(function () {
            window.location.href = 'portal.html';
        }, 1000);
        
    } catch (error) {
        clearTimeout(timeoutId);

        var msg;
        if (error.name === 'AbortError') {
            msg = 'Registration is taking too long. Please check your connection and try again.';
            console.error('[Register] registration request timed out');
        } else {
            msg = error.message || 'Something went wrong. Please try again.';
            console.error('[Register] registration error:', error);
        }

        registerError.textContent = msg;
        registerError.style.display = 'block';
        registerButton.disabled = false;
        registerButtonText.textContent = 'Register';
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

function validateRegistrationForm(email, password, confirmPassword, termsAccepted) {
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
    
    if (password !== confirmPassword) {
        return 'Passwords do not match.';
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

