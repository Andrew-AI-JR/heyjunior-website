/* register.js - User Registration */

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? window.location.origin.replace(/:\d+$/, ':8001') 
    : 'https://api.heyjunior.ai';

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
    
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const registerButton = document.getElementById('register-button');
    const registerButtonText = document.getElementById('register-button-text');
    const registerError = document.getElementById('register-error');
    
    // Clear previous errors
    registerError.style.display = 'none';
    
    // Validate form
    const validationError = validateRegistrationForm(email, password, confirmPassword);
    if (validationError) {
        registerError.textContent = validationError;
        registerError.style.display = 'block';
        return;
    }
    
        // Show loading state
        registerButton.disabled = true;
        registerButtonText.textContent = 'Registering...';
    
    try {
        // Get referral code from hidden field
        const referralCode = document.getElementById('referral-code-field').value;
        
        // Build request body
        const requestBody = {
            email: email,
            password: password
        };
        
        // Include referral code if available
        if (referralCode) {
            requestBody.referral_code = referralCode.toUpperCase();
            console.log('Including referral code in registration:', referralCode);
        }
        
        // Register user
        const response = await fetch(`${API_BASE_URL}/api/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        // Check content type before parsing
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error(text || 'Registration failed. Please try again.');
        }
        
        if (!response.ok) {
            // Handle validation errors (422) - detail is an array
            let errorMessage = 'Registration failed. Please try again.';
            if (data.detail) {
                if (Array.isArray(data.detail)) {
                    errorMessage = data.detail.map(err => err.msg || err.message || 'Validation error').join('. ');
                } else if (typeof data.detail === 'string') {
                    errorMessage = data.detail;
                } else {
                    errorMessage = data.detail.message || JSON.stringify(data.detail);
                }
            } else if (data.message) {
                errorMessage = data.message;
            }
            
            // Handle account already exists
            if (response.status === 409 || errorMessage.toLowerCase().includes('already exists')) {
                errorMessage = 'An account with this email already exists. Please login instead.';
            }
            
            throw new Error(errorMessage);
        }
        
        // Registration successful
        console.log('Registration successful:', data);
        
        // Save user data
        if (data.id) {
            sessionStorage.setItem('userId', data.id.toString());
            sessionStorage.setItem('userEmail', data.email || email);
        }
        
        // Auto-login the user after registration
        try {
            const loginResponse = await fetch(`${API_BASE_URL}/api/users/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: email,
                    password: password
                })
            });
            
            if (loginResponse.ok) {
                const loginData = await loginResponse.json();
                if (loginData.access_token) {
                    sessionStorage.setItem('userToken', loginData.access_token);
                    currentUserToken = loginData.access_token;
                }
                if (loginData.refresh_token) {
                    sessionStorage.setItem('refreshToken', loginData.refresh_token);
                }
            }
        } catch (loginError) {
            console.warn('Auto-login after registration failed, user will need to login manually:', loginError);
            // Continue anyway - user can login manually
        }
        
        // Clear referral code after successful registration (it's been used)
        if (referralCode) {
            localStorage.removeItem('referralCode');
            localStorage.removeItem('referralTimestamp');
            console.log('Referral code cleared after successful registration');
        }
        
        // Show success message and start download for user's system (detected platform)
        console.log('[Register] Registration successful, starting automatic download');
        registerButtonText.textContent = 'Account Created! Starting download...';
        const downloadFallback = document.getElementById('register-download-fallback');
        const downloadLink = document.getElementById('register-download-link');
        try {
            await startAppDownload();
            console.log('[Register] startAppDownload completed');
            // Show visible fallback link in case auto-download was blocked (e.g. popup blocker)
            if (window.juniorReleaseManager && downloadFallback && downloadLink) {
                const url = await window.juniorReleaseManager.getDownloadUrl('auto');
                if (url) {
                    downloadLink.href = url;
                    downloadFallback.style.display = 'block';
                    console.log('[Register] Fallback download link shown (user can click if download did not start)');
                }
            }
            console.log('[Register] Redirecting to portal in 2s');
            setTimeout(() => {
                window.location.href = 'portal.html';
            }, 2000);
        } catch (downloadError) {
            console.error('[Register] Download error:', downloadError);
            if (window.juniorReleaseManager && downloadFallback && downloadLink) {
                window.juniorReleaseManager.getDownloadUrl('auto').then(url => {
                    if (url) {
                        downloadLink.href = url;
                        downloadFallback.style.display = 'block';
                        console.log('[Register] Fallback download link shown after error');
                    }
                }).catch(() => {});
            }
            registerButtonText.textContent = 'Account created! Redirecting...';
            console.log('[Register] Redirecting to portal in 2s (after download error)');
            setTimeout(() => {
                window.location.href = 'portal.html';
            }, 2000);
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        registerError.textContent = error.message || 'Registration failed. Please check your information and try again.';
        registerError.style.display = 'block';
        registerButton.disabled = false;
        registerButtonText.textContent = 'Register';
    }
}

function validateRegistrationForm(email, password, confirmPassword) {
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
    
    return null;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function startAppDownload() {
    if (!window.juniorReleaseManager) {
        console.log('[Register] Release manager not ready, waiting 1s');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!window.juniorReleaseManager) {
        console.error('[Register] Release manager unavailable');
        throw new Error('Download service unavailable. Please refresh the page or contact support@heyjunior.ai');
    }
    console.log('[Register] Triggering download for detected system (platform: auto)');
    await window.juniorReleaseManager.triggerDownload('auto');
}
