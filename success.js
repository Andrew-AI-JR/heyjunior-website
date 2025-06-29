// Success page functionality for download only
const API_BASE_URL = 'https://junior-api-915940312680.us-west1.run.app';

// Platform-specific download URLs
const downloadUrls = {
    'windows': 'https://github.com/Andrew-AI-JR/Desktop-Releases/releases/download/v1.0.0-beta/Junior.Setup.1.0.0.exe',
    'macos-intel': 'https://github.com/Andrew-AI-JR/Desktop-Releases/releases/download/v1.0.0-beta/Junior-1.0.0.dmg',
    'macos-arm': 'https://github.com/Andrew-AI-JR/Desktop-Releases/releases/download/v1.0.0-beta/Junior-1.0.0-arm64.dmg'
};

// Track if download was initiated
let downloadInitiated = false;

// Helper function to show loading state
function showLoading(message = 'Loading...') {
    document.body.innerHTML = `
        <div style="text-align: center; padding: 2rem; max-width: 600px; margin: 0 auto;">
            <h2>${message}</h2>
            <div class="spinner" style="margin: 2rem auto;"></div>
        </div>
    `;
}

// Helper function to show error message
function showError(message, showBackButton = true) {
    document.body.innerHTML = `
        <div style="text-align: center; padding: 2rem; max-width: 600px; margin: 0 auto;">
            <h2>Error</h2>
            <p>${message}</p>
            ${showBackButton ? '<p><a href="/pricing.html" class="button">Back to Pricing</a></p>' : ''}
        </div>`;
}

// Helper function to update all email placeholders in the page
function updateAllEmailPlaceholders(email) {
    const emailElements = document.querySelectorAll('.user-email, .customer-email');
    emailElements.forEach(el => {
        el.textContent = email || 'your email address';
    });
}

// Handle account creation with proper loading and error states
async function handleAccountCreation(checkoutData, isFromStripeCheckout = false) {
    showLoading('Creating your account...');
    
    try {
        const response = await createUserAccount(checkoutData.email, checkoutData.coupon);
        
        if (response.success) {
            // Clear the checkout data from storage
            sessionStorage.removeItem('checkoutData');
            localStorage.removeItem('pendingAccountCreation');
            
            // Store the API key for download
            if (response.api_key) {
                sessionStorage.setItem('apiKey', response.api_key);
                localStorage.setItem('apiKey', response.api_key);
            }
            
            // If this is from Stripe Checkout, we might already be on the success page
            if (isFromStripeCheckout) {
                showSuccess(checkoutData.email, true);
            } else {
                // Redirect to success page with account created state
                window.location.href = `/success.html?account_created=true&email=${encodeURIComponent(checkoutData.email)}`;
            }
        } else {
            throw new Error(response.message || 'Failed to create account');
        }
    } catch (error) {
        console.error('Error creating account:', error);
        showError(
            `Account creation failed: ${error.message || 'An error occurred while creating your account. Please try again or contact support.'}`,
            true
        );
    }
}

// Show success message with download options
function showSuccess(email, showDownloadButton = true) {
    document.body.innerHTML = `
        <div class="success-container" style="text-align: center; padding: 2rem; max-width: 800px; margin: 0 auto;">
            <div class="success-icon" style="font-size: 72px; color: #4CAF50; margin-bottom: 1.5rem;">✓</div>
            <h1>Thank You for Your Purchase!</h1>
            <p>Your account has been successfully created with the email: <strong>${email}</strong></p>
            
            ${showDownloadButton ? `
            <div class="download-section" style="margin: 2rem 0;">
                <h2>Ready to Get Started?</h2>
                <p>Download the application and start using it right away.</p>
                <a href="/download.html" class="button" style="margin: 1rem 0;">Download Now</a>
            </div>
            ` : ''}
            
            <div class="next-steps" style="margin-top: 2rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
                <h3>Next Steps:</h3>
                <ol style="text-align: left; padding-left: 1.5rem;">
                    <li>Download and install the application</li>
                    <li>Launch the application and sign in with your email</li>
                    <li>Start using all the premium features</li>
                </ol>
            </div>
            
            <div class="support" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #eee;">
                <p>Need help? <a href="/support.html">Contact our support team</a></p>
            </div>
        </div>`;
}

// Helper function to update all email placeholders in the page
function updateAllEmailPlaceholders(email) {
    const emailElements = document.querySelectorAll('.user-email');
    emailElements.forEach(el => {
        el.textContent = email;
    });
}

// Handle account creation with proper loading and error states
async function handleAccountCreation(checkoutData, isFromStripeCheckout = false) {
    showLoading('Creating your account...');
    
    try {
        const response = await createUserAccount(checkoutData.email, checkoutData.coupon);
        
        if (response.success) {
            // Clear the checkout data from storage
            sessionStorage.removeItem('checkoutData');
            localStorage.removeItem('pendingAccountCreation');
            
            // Store the API key for download
            if (response.api_key) {
                sessionStorage.setItem('apiKey', response.api_key);
                localStorage.setItem('apiKey', response.api_key);
            }
            
            // If this is from Stripe Checkout, we might already be on the success page
            if (isFromStripeCheckout) {
                showSuccess(checkoutData.email, true);
            } else {
                // Redirect to success page with account created state
                window.location.href = `/success.html?account_created=true&email=${encodeURIComponent(checkoutData.email)}`;
            }
        } else {
            throw new Error(response.message || 'Failed to create account');
        }
    } catch (error) {
        console.error('Error creating account:', error);
        showError(
            `Account creation failed: ${error.message || 'An error occurred while creating your account. Please try again or contact support.'}`,
            true
        );
    }
}

// Show success message with download options
function showSuccess(email, showDownloadButton = true) {
    document.body.innerHTML = `
        <div class="success-container" style="text-align: center; padding: 2rem; max-width: 800px; margin: 0 auto;">
            <div class="success-icon" style="font-size: 72px; color: #4CAF50; margin-bottom: 1.5rem;">✓</div>
            <h1>Thank You for Your Purchase!</h1>
            <p>Your account has been successfully created with the email: <strong>${email}</strong></p>
            
            ${showDownloadButton ? `
            <div class="download-section" style="margin: 2rem 0;">
                <h2>Ready to Get Started?</h2>
                <p>Download the application and start using it right away.</p>
                <a href="/download.html" class="button" style="margin: 1rem 0;">Download Now</a>
            </div>
            ` : ''}
            
            <div class="next-steps" style="margin-top: 2rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
                <h3>Next Steps:</h3>
                <ol style="text-align: left; padding-left: 1.5rem;">
                    <li>Download and install the application</li>
                    <li>Launch the application and sign in with your email</li>
                    <li>Start using all the premium features</li>
                </ol>
            </div>
            
            <div class="support" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #eee;">
                <p>Need help? <a href="/support.html">Contact our support team</a></p>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check URL parameters for free account and session ID
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const isFreeAccount = urlParams.get('free_account') === 'true';
    const couponCode = urlParams.get('coupon');
    const downloadStarted = urlParams.get('download_started') === 'true';
    const providedApiKey = urlParams.get('api_key');
    
    // Get checkout data from session/localStorage
    const checkoutDataStr = sessionStorage.getItem('checkoutData') || localStorage.getItem('pendingAccountCreation');
    const paymentDataStr = sessionStorage.getItem('paymentData') || localStorage.getItem('paymentData');
    
    let email = 'your email address';
    let platform = 'your selected platform';
    let paymentIntentId = null;
    let stripeSessionId = null;
    
    // If we have a session ID from Stripe Checkout, verify it
    if (sessionId) {
        try {
            showLoading('Verifying your payment...');
            
            // Verify the session with the backend
            const response = await fetch(`${API_BASE_URL}/api/payments/verify-session?session_id=${sessionId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to verify payment');
            }
            
            const sessionData = await response.json();
            
            // Store the verified session data
            if (sessionData.customer_email) {
                email = sessionData.customer_email;
                
                // Update the checkout data with the verified email
                if (checkoutData) {
                    checkoutData.email = sessionData.customer_email;
                    sessionStorage.setItem('checkoutData', JSON.stringify(checkoutData));
                    localStorage.setItem('pendingAccountCreation', JSON.stringify(checkoutData));
                }
                
                // Update the UI with the verified email
                updateAllEmailPlaceholders(sessionData.customer_email);
            }
            
            // Store the session ID for later use
            stripeSessionId = sessionId;
            
            // If subscription is active, set flag
            if (sessionData.status === 'complete' || sessionData.payment_status === 'paid') {
                subscriptionActive = true;
                
                // If we have checkout data, proceed with account creation
                if (checkoutData) {
                    await handleAccountCreation(checkoutData, true);
                    return;
                }
            }
            
        } catch (error) {
            console.error('Error verifying session:', error);
            showError(
                `We couldn't verify your payment: ${error.message || 'Please try again or contact support.'}`,
                true
            );
            return;
        }
    }

    if (checkoutDataStr) {
        try {
            const checkoutData = JSON.parse(checkoutDataStr);
            email = checkoutData.email || email;
            platform = checkoutData.platform || platform;
        } catch (error) {
            console.error('Error parsing checkout data:', error);
        }
    }

    if (paymentDataStr) {
        try {
            const paymentData = JSON.parse(paymentDataStr);
            paymentIntentId = paymentData.payment_intent || paymentData.payment_intent_id;
        } catch (error) {
            console.error('Error parsing payment data:', error);
        }
    }

    // Display order information
    displayOrderInfo(email, platform, isFreeAccount, couponCode);

    // Handle different flows
    if (isFreeAccount) {
        if (downloadStarted) {
            // Download already started from checkout page
            showAccountCreationStatus('🎉 Download started! Your free account is ready.', 'success');
            if (providedApiKey) {
                // Show account setup instead of API key
                showAccountSetupInfo(email, 'tacos');
            }
        } else {
            // Handle free account creation and download
            await handleFreeAccountCreationAndDownload(email, platform, couponCode);
        }
    } else if (paymentIntentId) {
        // Handle paid account
        await handlePaymentVerificationAndDownload(paymentIntentId, email, platform);
    } else {
        // Fallback - show generic success
        showAccountCreationStatus('Thank you for your purchase! Please check your email for download instructions.', 'info');
    }

    // Auto-start download immediately if we have platform info
    if (platform && (platform === 'windows' || platform.startsWith('mac'))) {
        const downloadUrl = getDownloadUrl(platform);
        console.log('Starting auto-download:', downloadUrl);
        
        // Create hidden link and trigger click
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadUrl.split('/').pop();
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Also show the download button as fallback
        startDirectDownload(platform);
    }
});

async function handlePaymentVerificationAndDownload(paymentIntentId, email, platform) {
    try {
        showAccountCreationStatus('Verifying payment and preparing download...', 'info');
        
        // Normalize platform name
        const normalizedPlatform = PLATFORM_MAPPING[platform] || 'windows';
        
        // Verify payment and get download link
        const response = await fetch(`${API_BASE_URL}/api/downloads/verify-payment-and-generate-download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                payment_intent: paymentIntentId,
                platform: normalizedPlatform
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.verified) {
                showAccountCreationStatus('Payment verified! Starting download...', 'success');
                
                // Start download using the secure URL
                const downloadUrl = getDownloadUrl(platform);
                await startSecureDownload(downloadUrl, platform);
                
                // Also create account and API key
                await createUserAccount(email);
            } else {
                throw new Error(result.error || 'Payment verification failed');
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        showAccountCreationStatus('Payment verification failed. Please contact support.', 'error');
    }
}

async function handleFreeAccountCreationAndDownload(email, platform, couponCode) {
    try {
        showAccountCreationStatus(`Validating your coupon "${couponCode}"...`, 'info');
        
        // First validate the coupon with the backend
        const validationResponse = await fetch(`${API_BASE_URL}/api/payments/validate-coupon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coupon_code: couponCode })
        });
        
        const validationResult = await validationResponse.json();
        
        if (!validationResponse.ok || !validationResult.valid) {
            throw new Error(validationResult.message || 'Invalid or expired coupon');
        }
        
        // Only proceed with download if coupon is valid
        showAccountCreationStatus(`🎉 Free account activated with "${couponCode}" coupon! Preparing download...`, 'success');
        
        // Normalize platform name
        const normalizedPlatform = PLATFORM_MAPPING[platform] || 'windows';
        
        // Create user account first
        const accountCreated = await createUserAccount(email, couponCode);
        if (!accountCreated) {
            throw new Error('Failed to create user account');
        }
        
        // Start download
        await startDirectDownload(platform);
        
        // Show success message
        showAccountCreationStatus('🆓 Your free 1-month subscription is active! Download starting...', 'success');
        
        // Show account setup info
        showAccountSetupInfo(email, couponCode);
        
    } catch (error) {
        console.error('Error handling free account:', error);
        showAccountCreationStatus(`Error: ${error.message || 'Failed to process free account. Please contact support.'}`, 'error');
        
        // Show a button to go back to the homepage
        const errorContainer = document.querySelector('.account-creation-status.error');
        if (errorContainer) {
            const backButton = document.createElement('a');
            backButton.href = '/pricing';
            backButton.className = 'btn btn-primary';
            backButton.textContent = 'Return to Pricing';
            backButton.style.marginTop = '20px';
            backButton.style.display = 'inline-block';
            errorContainer.appendChild(document.createElement('br'));
            errorContainer.appendChild(backButton);
        }
    }
}

function showAccountSetupInfo(email, couponCode) {
    const accountSetupMsg = document.createElement('div');
    accountSetupMsg.className = 'account-setup-message';
    accountSetupMsg.style.cssText = `
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    `;
    
    if (couponCode) {
        accountSetupMsg.innerHTML = `
            <h3 style="margin: 0 0 10px 0; font-size: 1.4em;">🎉 Welcome to Junior - FREE for 1 Month!</h3>
            <p style="margin: 0 0 15px 0; opacity: 0.9;">
                Your "${couponCode}" coupon has been successfully applied.<br>
                Enjoy full access to all premium features until ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}.
            </p>
            <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; margin-top: 15px;">
                <strong>✨ What's included in your free month:</strong><br>
                • Unlimited LinkedIn automation<br>
                • AI-powered comment generation<br>
                • Advanced targeting features<br>
                • Priority support
            </div>
            <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; margin-top: 15px;">
                <strong>🔧 Setup Instructions:</strong><br>
                1. Download and install the app<br>
                2. On first launch, create your username and password<br>
                3. Use email: <strong>${email}</strong><br>
                4. Your account is already created and ready!
            </div>
        `;
    } else {
        accountSetupMsg.innerHTML = `
            <h3 style="margin: 0 0 10px 0; font-size: 1.4em;">🎉 Account Successfully Created!</h3>
            <p style="margin: 0 0 15px 0; opacity: 0.9;">
                Your Junior account has been set up and is ready to use.
            </p>
            <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; margin-top: 15px;">
                <strong>🔧 Setup Instructions:</strong><br>
                1. Download and install the app<br>
                2. On first launch, create your username and password<br>
                3. Use email: <strong>${email}</strong><br>
                4. Your account is already created and ready!
            </div>
        `;
    }
    
    // Insert after any existing API key section or at the container
    const container = document.querySelector('.success-container') || document.body;
    container.appendChild(accountSetupMsg);
}

async function startDirectDownload(platform) {
    // Create a nice download ready section
    const downloadSection = document.createElement('div');
    downloadSection.className = 'download-ready-section';
    downloadSection.style.cssText = `
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        border-radius: 12px;
        padding: 25px;
        margin: 20px 0;
        text-align: center;
        box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    `;
    
    downloadSection.innerHTML = `
        <h3 style="margin: 0 0 15px 0; font-size: 1.4em;">🚀 Download Ready!</h3>
        <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 1.1em;">
            Your Junior for ${platform === 'windows' ? 'Windows' : 'macOS'} is ready to download.
        </p>
        <button id="direct-download-btn" style="
            background: rgba(255,255,255,0.2);
            border: 2px solid white;
            color: white;
            padding: 15px 40px;
            border-radius: 8px;
            font-size: 1.2em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
           onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            📥 Download Now
        </button>
        <div style="font-size: 0.9em; opacity: 0.8; margin-top: 15px;">
            Standard plan • Secure download
        </div>
    `;
    
    // Insert into page
    const container = document.querySelector('.main-content') || document.body;
    container.appendChild(downloadSection);
    
    // Add download functionality
    document.getElementById('direct-download-btn').addEventListener('click', function() {
        const actualDownloadUrl = getDownloadUrl(platform);
        
        // User-initiated download
        const link = document.createElement('a');
        link.href = actualDownloadUrl;
        link.download = actualDownloadUrl.split('/').pop();
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Update button
        this.innerHTML = '✅ Download Started!';
        this.style.background = 'rgba(255,255,255,0.3)';
        this.disabled = true;
    });
}

// Secure download for paid accounts. Shows the same download UI but uses
// the signed/secure URL returned by backend verification instead of the
// public GitHub link. Keeps one click so browsers allow redirect.
async function startSecureDownload(downloadUrl, platform) {
    // Reuse the UI creation from startDirectDownload
    await startDirectDownload(platform);
    // Replace click handler to use secure URL
    const btn = document.getElementById('direct-download-btn');
    if (!btn) return;

    // Remove previous listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', function () {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadUrl.split('/').pop();
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.innerHTML = '✅ Download Started!';
        this.style.background = 'rgba(255,255,255,0.3)';
        this.disabled = true;
    });
}

async function createUserAccount(email, couponCode = null) {
    try {
        if (!email) {
            console.error('Email is required to create an account');
            return false;
        }

        // If no coupon code, just send welcome email and return
        if (!couponCode) {
            await sendWelcomeEmail(email);
            return true;
        }

        // Create the user account with the coupon code
        const response = await fetch(`${API_BASE_URL}/api/payments/create-free-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                coupon_code: couponCode,
                source: 'website_checkout'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Failed to create account:', result);
            throw new Error(result.detail?.message || 'Failed to create free account');
        }

        // Show setup instructions to the user
        showAccountSetupInfo(email, couponCode);
        
        // Send welcome email
        await sendWelcomeEmail(email);
        
        return true;
    } catch (error) {
        console.error('Error creating user account:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

async function sendWelcomeEmail(email) {
    try {
        await fetch(`${API_BASE_URL}/api/downloads/send-welcome-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_email: email
            })
        });
    } catch (error) {
        console.error('Error sending welcome email:', error);
    }
}

// JWT/OAuth Authentication - Account setup handled on first app launch
// No API keys needed - users create username/password during installation

function showAccountCreationStatus(message, type = 'info') {
    // Remove existing status
    const existingStatus = document.querySelector('.account-creation-status');
    if (existingStatus) existingStatus.remove();
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `account-creation-status status-${type}`;
    statusDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 1002;
        font-weight: 500;
        max-width: 400px;
        text-align: center;
    `;
    
    statusDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            ${type === 'info' ? '<div class="spinner"></div>' : ''}
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(statusDiv);
    
    // Auto-remove success/warning messages after 5 seconds
    if (type !== 'info') {
        setTimeout(() => {
            if (statusDiv.parentNode) statusDiv.remove();
        }, 5000);
    }
}

// Add spinner CSS
const spinnerStyles = document.createElement('style');
spinnerStyles.textContent = `
    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(spinnerStyles);

function displayOrderInfo(email, platform, isFreeAccount, couponCode) {
    const emailElements = document.querySelectorAll('.customer-email');
    emailElements.forEach(el => {
        el.textContent = email;
    });
    
    const platformElements = document.querySelectorAll('.selected-platform');
    platformElements.forEach(el => {
        el.textContent = platform === 'windows' ? 'Windows' : (platform === 'macos' ? 'macOS' : 'your selected platform');
    });
    
    // Hide license section for beta
    const licenseSection = document.querySelector('.license-section');
    if (licenseSection) {
        licenseSection.style.display = 'none';
    }

    // Update payment status
    const paymentStatusDiv = document.querySelector('.payment-status');
    if (paymentStatusDiv) {
        const existingNotice = paymentStatusDiv.querySelector('.payment-success-notice');
        if (existingNotice) existingNotice.remove();

        const successMessage = document.createElement('div');
        successMessage.className = 'payment-success-notice';
        
        if (isFreeAccount) {
            // Free account success message
            successMessage.style.cssText = `
                background: linear-gradient(135deg, #f0fdf4, #dcfce7);
                border: 2px solid #10b981;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
                position: relative;
                overflow: hidden;
            `;
            successMessage.innerHTML = `
                <div style="position: absolute; top: -5px; right: -5px; background: #10b981; color: white; padding: 5px 15px; border-radius: 0 12px 0 12px; font-size: 0.9em; font-weight: bold;">FREE</div>
                <h3 style="color: #059669; margin-bottom: 10px; font-size: 1.3em;">🎉 Free Account Activated!</h3>
                <p style="color: #065f46; margin-bottom: 15px; font-size: 1.1em;">Your <strong>"${couponCode}"</strong> coupon has been applied successfully!</p>
                <div style="background: rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 15px; margin: 15px 0;">
                    <p style="color: #059669; margin: 0; font-weight: 500;">✨ Enjoy <strong>1 month FREE</strong> access to all premium features!</p>
                    <p style="color: #065f46; margin: 5px 0 0 0; font-size: 0.9em;">Your download for <strong>${platform === 'windows' ? 'Windows' : 'macOS'}</strong> will start automatically.</p>
                </div>
            `;
        } else {
            // Paid account success message
            successMessage.style.cssText = `
                background: #e0f2fe;
                border: 1px solid #7dd3fc;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            `;
            successMessage.innerHTML = `
                <h3 style="color: #0c4a6e; margin-bottom: 10px;">🎉 Payment Successful!</h3>
                <p style="color: #075985; margin-bottom: 15px;">Your account is being created and your download for <strong>${platform === 'windows' ? 'Windows' : 'macOS'}</strong> will start automatically.</p>
                <p style="color: #075985;">You'll receive an email with your account details and login instructions.</p>
            `;
        }
        
        const successHeader = document.querySelector('.success-header');
        if (successHeader) {
            successHeader.insertAdjacentElement('afterend', successMessage);
        } else {
            paymentStatusDiv.prepend(successMessage);
        }
    }
}

function updateDownloadButtons(platform) {
    document.querySelectorAll('.download-option').forEach(option => {
        option.style.display = 'none';
    });

    const effectivePlatform = platform || 'windows';

    if (effectivePlatform === 'windows') {
        const windowsOption = document.querySelector('.download-option.windows');
        if (windowsOption) {
            windowsOption.style.display = 'block';
            windowsOption.classList.add('recommended');
            const button = windowsOption.querySelector('.download-button');
            if (button) button.href = getDownloadUrl('windows');
        }
    } else { 
        // Show both macOS options for user to choose
        const macIntelOption = document.querySelector('.download-option.macos');
        const macArmOption = document.querySelector('.download-option.macos-arm');
        
        // Detect if user is on ARM Mac for recommendations
        const isArmMac = navigator.userAgent.includes('Mac') && 
                        (navigator.userAgent.includes('ARM') || 
                         window.navigator.platform === 'MacIntel' && 
                         window.navigator.maxTouchPoints > 1);
        
        if (macIntelOption) {
            macIntelOption.style.display = 'block';
            if (!isArmMac) {
                macIntelOption.classList.add('recommended');
            }
            const button = macIntelOption.querySelector('.download-button');
            if (button) {
                button.href = getDownloadUrl('macos-intel');
            }
        }
        
        if (macArmOption) {
            macArmOption.style.display = 'block';
            if (isArmMac) {
                macArmOption.classList.add('recommended');
            }
            const button = macArmOption.querySelector('.download-button');
            if (button) {
                button.href = getDownloadUrl('macos-arm');
            }
        }
    }
}

function updateInstructions(platform, email) {
    const instructionsBox = document.querySelector('.instructions-box');
    if (!instructionsBox) return;

    const effectivePlatform = platform || 'windows';

    let platformSpecificInstructions = '';
    if (effectivePlatform === 'windows') {
        platformSpecificInstructions = `
            <h3>🖥️ Windows Installation & Account Setup</h3>
            <ol>
                <li>Your download should start automatically. If not, use the button above.</li>
                <li>Extract the ZIP file and run "LinkedIn_Automation_Tool.exe".</li>
                <li>When prompted, enter your account email: <strong>${email}</strong></li>
                <li>Check your email for login credentials and setup instructions.</li>
                <li>Follow the on-screen prompts to complete installation and account verification.</li>
            </ol>
            <p><small><strong>Note:</strong> You'll need to verify your account before the tool can be used. Check your email for instructions.</small></p>
        `;
    } else { 
        platformSpecificInstructions = `
            <h3>🍎 macOS Installation & Account Setup</h3>
            <ol>
                <li>Your download should start automatically. If not, use the button above.</li>
                <li>Open the DMG file and drag the app to Applications.</li>
                <li>When you first run the app, enter your account email: <strong>${email}</strong></li>
                <li>Check your email for login credentials and setup instructions.</li>
                <li>Complete the account verification process within the app.</li>
            </ol>
            <p><small><strong>Note:</strong> You'll need to verify your account before the tool can be used. Check your email for instructions.</small></p>
        `;
    }
    instructionsBox.innerHTML = platformSpecificInstructions;
}

function showDownloadNotification(platform) {
    // Remove account creation status
    const accountStatus = document.querySelector('.account-creation-status');
    if (accountStatus) accountStatus.remove();
    
    const existingNotification = document.querySelector('.download-notification-toast');
    if (existingNotification) existingNotification.remove();

    const notification = document.createElement('div');
    notification.className = 'download-notification-toast';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 1001;
        animation: slideInNotification 0.5s ease-out;
    `;
    notification.innerHTML = `
        <h4 style="margin: 0 0 5px 0;">🚀 Download Started!</h4>
        <p style="margin: 0; font-size: 0.9rem;">Your ${platform === 'windows' ? 'Windows' : 'macOS'} download has begun...</p>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutNotification 0.5s ease-in forwards';
        notification.addEventListener('animationend', () => {
            if (notification.parentNode) {
                notification.remove();
            }
        });
    }, 5000);
}

// Add notification animations
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInNotification {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutNotification {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(notificationStyles);

const dynamicNotificationStyles = document.createElement('style');
dynamicNotificationStyles.textContent = `
    @keyframes slideInNotification {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutNotification {
function updateAllEmailPlaceholders(email) {
    const emailElements = document.querySelectorAll('.user-email');
    emailElements.forEach(el => {
        el.textContent = email;
    });
}

// Handle account creation with proper loading and error states
async function handleAccountCreation(checkoutData, isFromStripeCheckout = false) {
    showLoading('Creating your account...');
    
    try {
        const response = await createUserAccount(checkoutData.email, checkoutData.coupon);
        
        if (response.success) {
            // Clear the checkout data from storage
            sessionStorage.removeItem('checkoutData');
            localStorage.removeItem('pendingAccountCreation');
            
            // Store the API key for download
            if (response.api_key) {
                sessionStorage.setItem('apiKey', response.api_key);
                localStorage.setItem('apiKey', response.api_key);
            }
            
            // If this is from Stripe Checkout, we might already be on the success page
            if (isFromStripeCheckout) {
                showSuccess(checkoutData.email, true);
            } else {
                // Redirect to success page with account created state
                window.location.href = `/success.html?account_created=true&email=${encodeURIComponent(checkoutData.email)}`;
            }
        } else {
            throw new Error(response.message || 'Failed to create account');
        }
    } catch (error) {
        console.error('Error creating account:', error);
        showError(
            `Account creation failed: ${error.message || 'An error occurred while creating your account. Please try again or contact support.'}`,
            true
        );
    }
}

// Show success message with download options
function showSuccess(email, showDownloadButton = true) {
    document.body.innerHTML = `
        <div class="success-container" style="text-align: center; padding: 2rem; max-width: 800px; margin: 0 auto;">
            <div class="success-icon" style="font-size: 72px; color: #4CAF50; margin-bottom: 1.5rem;">✓</div>
            <h1>Thank You for Your Purchase!</h1>
            <p>Your account has been successfully created with the email: <strong>${email}</strong></p>
            
            ${showDownloadButton ? `
            <div class="download-section" style="margin: 2rem 0;">
                <h2>Ready to Get Started?</h2>
                <p>Download the application and start using it right away.</p>
                <a href="/download.html" class="button" style="margin: 1rem 0;">Download Now</a>
            </div>
            ` : ''}
            
            <div class="next-steps" style="margin-top: 2rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
                <h3>Next Steps:</h3>
                <ol style="text-align: left; padding-left: 1.5rem;">
                    <li>Download and install the application</li>
                    <li>Launch the application and sign in with your email</li>
                    <li>Start using all the premium features</li>
                </ol>
            </div>
            
            <div class="support" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #eee;">
                <p>Need help? <a href="/support.html">Contact our support team</a></p>
            </div>
        </div>
    `;
}

if (sessionStorage.getItem('checkoutData')) {
    updateAllEmailPlaceholders(JSON.parse(sessionStorage.getItem('checkoutData')).email);
}

// Auto-scroll to download section (only if no automatic download was triggered)
setTimeout(() => {
    if (!downloadTriggered) {
        const downloadSection = document.querySelector('.download-section');
        if (downloadSection) {
            downloadSection.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
}, 1000);

// Add license management functions
function displayLicenseInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const licenseId = urlParams.get('license_id');
    const customerEmail = urlParams.get('email');
    
    // Try to get license from localStorage
    const storedLicense = localStorage.getItem('user_license');
    
    if (licenseId && customerEmail) {
        // Show license info section
        const licenseInfoSection = document.getElementById('licenseInfo');
        if (licenseInfoSection) {
            licenseInfoSection.style.display = 'block';
            
            // Populate license details
            document.getElementById('licenseId').textContent = licenseId;
            document.getElementById('customerEmail').textContent = customerEmail;
            
            // If we have stored license data, show the key
            if (storedLicense) {
                try {
                    const licenseData = JSON.parse(storedLicense);
                    if (licenseData.license_key) {
                        document.getElementById('licenseKey').value = licenseData.license_key;
                    }
                } catch (error) {
                    console.error('Error parsing stored license:', error);
                }
            }
        }
    }
}

function copyLicenseKey() {
    const licenseKeyField = document.getElementById('licenseKey');
    if (licenseKeyField && licenseKeyField.value) {
        licenseKeyField.select();
        licenseKeyField.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            
            // Update button text temporarily
            const copyBtn = document.querySelector('.copy-btn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            copyBtn.style.backgroundColor = '#10b981';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.backgroundColor = '';
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy license key:', error);
            alert('Failed to copy license key. Please select and copy manually.');
        }
    }
}

// Add CSS styles for license section and auto-download notice
function addLicenseStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Prominent Download Section Styles */
        .download-section-prominent {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            padding: 40px;
            margin: 30px 0;
            color: white;
            text-align: center;
            box-shadow: 0 15px 35px rgba(0,0,0,0.2);
        }
        
        .download-header h2 {
            font-size: 2.2em;
            margin: 0 0 10px 0;
            color: white;
        }
        
        .download-subtitle {
            font-size: 1.2em;
            margin: 0 0 30px 0;
            opacity: 0.9;
        }
        
        .download-buttons-large {
            display: flex;
            gap: 30px;
            justify-content: center;
            flex-wrap: wrap;
            margin: 30px 0;
        }
        
        .download-option-large {
            background: rgba(255,255,255,0.15);
            border-radius: 15px;
            padding: 30px;
            min-width: 280px;
            position: relative;
            transition: all 0.3s ease;
            border: 2px solid transparent;
        }
        
        .download-option-large:hover {
            transform: translateY(-5px);
            background: rgba(255,255,255,0.2);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .download-option-large.recommended {
            border-color: #fbbf24;
            background: rgba(255,255,255,0.25);
        }
        
        .download-icon-large {
            font-size: 4em;
            margin-bottom: 15px;
        }
        
        .download-option-large h3 {
            font-size: 1.8em;
            margin: 0 0 10px 0;
            color: white;
        }
        
        .download-option-large p {
            margin: 0 0 20px 0;
            opacity: 0.8;
            font-size: 1.1em;
        }
        
        .download-button-large {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: bold;
            font-size: 1.2em;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            width: 100%;
            box-sizing: border-box;
        }
        
        .download-button-large:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        
        .recommended-badge {
            position: absolute;
            top: -10px;
            right: -10px;
            background: #fbbf24;
            color: #1f2937;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.8em;
            font-weight: bold;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        }
        
        .auto-download-indicator {
            margin-top: 15px;
            padding: 10px;
            background: rgba(16, 185, 129, 0.2);
            border-radius: 8px;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .pulse-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            animation: pulse-dot 1.5s infinite;
        }
        
        @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }
        
        /* Collapsible Sections */
        .license-info-collapsible,
        .quick-start-collapsible,
        .beta-benefits-collapsible {
            background: #f8f9fa;
            border-radius: 12px;
            margin: 20px 0;
            overflow: hidden;
            border: 1px solid #e9ecef;
        }
        
        .collapsible-header {
            background: #e9ecef;
            padding: 20px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.3s ease;
        }
        
        .collapsible-header:hover {
            background: #dee2e6;
        }
        
        .collapsible-header h3 {
            margin: 0;
            color: #495057;
            font-size: 1.3em;
        }
        
        .toggle-icon {
            font-size: 1.2em;
            color: #6c757d;
            transition: transform 0.3s ease;
        }
        
        .collapsible-content {
            padding: 20px;
        }
        
        /* Quick Start Steps */
        .quick-start-steps {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .step {
            display: flex;
            align-items: flex-start;
            gap: 15px;
        }
        
        .step-number {
            background: #667eea;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            flex-shrink: 0;
        }
        
        .step-content h4 {
            margin: 0 0 5px 0;
            color: #495057;
        }
        
        .step-content p {
            margin: 0;
            color: #6c757d;
        }
        
        /* Benefits List */
        .benefits-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 10px;
        }
        
        .benefits-list li {
            padding: 8px 0;
            color: #495057;
            font-size: 1.1em;
        }
        
        /* Support Section */
        .support-section-compact {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 25px;
            text-align: center;
            margin: 30px 0;
        }
        
        .support-section-compact h3 {
            margin: 0 0 20px 0;
            color: #495057;
        }
        
        .support-links-compact {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .support-link {
            display: inline-block;
            padding: 12px 20px;
            background: #6c757d;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.3s ease;
            font-weight: 500;
        }
        
        .support-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .support-link.primary {
            background: #667eea;
        }
        
        .support-link.primary:hover {
            background: #5a67d8;
        }
        
        /* Auto-download notice from previous styles */
        .auto-download-notice {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
            animation: pulse 2s infinite;
        }
        
        .auto-download-notice p {
            margin: 0;
            font-weight: bold;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
        }
        
        /* License info styles (existing) */
        .license-info {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 25px;
            margin: 25px 0;
            color: white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .license-info h3 {
            margin-top: 0;
            color: #fff;
            font-size: 1.4em;
        }
        
        .license-details {
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
        }
        
        .license-details p {
            margin: 8px 0;
            font-size: 1.1em;
        }
        
        .status-active {
            background: #10b981;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
        }
        
        .license-key-section {
            margin-top: 20px;
        }
        
        .license-key-section h4 {
            color: #fff;
            margin-bottom: 10px;
        }
        
        .license-key-container {
            display: flex;
            gap: 10px;
            align-items: flex-start;
        }
        
        .license-key-display {
            flex: 1;
            min-height: 80px;
            padding: 12px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            resize: vertical;
            word-break: break-all;
        }
        
        .license-key-display:focus {
            outline: none;
            border-color: rgba(255,255,255,0.6);
        }
        
        .copy-btn {
            background: #10b981;
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            white-space: nowrap;
        }
        
        .copy-btn:hover {
            background: #059669;
            transform: translateY(-2px);
        }
        
        .license-note {
            margin-top: 15px;
            padding: 12px;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            font-size: 0.95em;
            border-left: 4px solid #fbbf24;
        }
        
        /* Mobile responsiveness */
        @media (max-width: 768px) {
            .download-buttons-large {
                flex-direction: column;
                align-items: center;
            }
            
            .download-option-large {
                min-width: 100%;
                max-width: 350px;
            }
            
            .download-section-prominent {
                padding: 25px 20px;
            }
            
            .download-header h2 {
                font-size: 1.8em;
            }
            
            .support-links-compact {
                flex-direction: column;
                align-items: center;
            }
            
            .license-key-container {
                flex-direction: column;
            }
            
            .copy-btn {
                align-self: flex-start;
            }
        }
        
        .account-creation-status.warning {
            background-color: #fef3c7;
            border-left-color: #f59e0b;
            color: #92400e;
        }
        
        /* API Key Display Styles */
        .api-key-section {
            margin-top: 20px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
        }
        
        .api-key-info h4 {
            margin: 0 0 10px 0;
            color: #1e40af;
        }
        
        .api-key-display {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 10px 0;
            padding: 10px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        
        .api-key-display code {
            flex: 1;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: #374151;
            background: none;
            padding: 0;
        }
        
        .copy-btn {
            padding: 6px 12px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }
        
        .copy-btn:hover {
            background: #2563eb;
        }
        
        .api-key-note {
            font-size: 14px;
            color: #6b7280;
            margin: 10px 0 0 0;
        }
    `;
    document.head.appendChild(style);
}

// Helper function to get download URL based on platform
function getDownloadUrl(platform) {
    // Detect macOS architecture
    if (platform === 'macos') {
        // Check for Apple Silicon
        const isAppleSilicon = navigator.userAgent.includes('Mac OS') && navigator.userAgent.includes('ARM');
        return isAppleSilicon ? downloadUrls['macos-arm'] : downloadUrls['macos-intel'];
    }
    
    return downloadUrls[platform] || downloadUrls['windows']; // Default to Windows
} 
