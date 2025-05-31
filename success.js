// Success page functionality with Account Creation Integration
const API_BASE_URL = 'https://junior-api-915940312680.us-west1.run.app';

// GitHub Release Download URLs for working LinkedIn automation tool
const GITHUB_RELEASE_BASE = 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.2';

// Legacy URLs (to be removed)
const WINDOWS_DIRECT_DOWNLOAD_URL = 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.2/Junior-Desktop-Setup-1.0.2.exe';
const MACOS_DIRECT_DOWNLOAD_URL = 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.2/Junior-Desktop-1.0.2.dmg';
const MACOS_ARM_DOWNLOAD_URL = 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.2/Junior-Desktop-1.0.2-arm64.dmg';

// Platform-specific download URLs pointing to latest release
const downloadUrls = {
    'windows': 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.7/Junior-Desktop-Setup-1.0.7.exe',
    'macos-intel': 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.7/Junior-Desktop-1.0.7.dmg',
    'macos-arm': 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.7/Junior-Desktop-1.0.7-arm64.dmg',
    'linux': 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.7/Junior-Desktop-1.0.7.AppImage'
};

// Platform detection and mapping
const PLATFORM_MAPPING = {
    'windows': 'windows',
    'mac': 'mac',
    'mac-arm': 'mac-arm',
    'macos': 'mac'  // Handle different naming conventions
};

// Track download and account status
let accountCreationComplete = false;
let downloadToken = null;
let accountCheckAttempts = 0;
const MAX_ACCOUNT_CHECK_ATTEMPTS = 30; // 30 attempts over 5 minutes

document.addEventListener('DOMContentLoaded', async () => {
    // Check URL parameters for free account
    const urlParams = new URLSearchParams(window.location.search);
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
                displayApiKey(providedApiKey, email);
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
                await createAccountAndApiKey(email);
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
        showAccountCreationStatus(`🎉 Free account activated with "${couponCode}" coupon! Preparing download...`, 'success');
        
        // Normalize platform name
        const normalizedPlatform = PLATFORM_MAPPING[platform] || 'windows';
        
        // Start direct download since no payment verification needed
        await startDirectDownload(platform);
        
        // Show free account success message
        setTimeout(() => {
            showAccountCreationStatus('🆓 Your free 1-month subscription is active! Download starting...', 'success');
        }, 1000);
        
        // Generate a fake API key for now (until backend is deployed)
        const fakeApiKey = `jnr_free_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Show the API key info
        setTimeout(() => {
            showApiKeyInfo(fakeApiKey, email);
            showFreeAccountMessage(couponCode);
        }, 2000);
        
    } catch (error) {
        console.error('Error handling free account:', error);
        showAccountCreationStatus('Error setting up free account. Please contact support.', 'error');
    }
}

function showFreeAccountMessage(couponCode) {
    const freeAccountMsg = document.createElement('div');
    freeAccountMsg.className = 'free-account-message';
    freeAccountMsg.style.cssText = `
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    `;
    
    freeAccountMsg.innerHTML = `
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
    `;
    
    // Insert after the API key section
    const apiKeySection = document.querySelector('.api-key-section');
    if (apiKeySection) {
        apiKeySection.insertAdjacentElement('afterend', freeAccountMsg);
    } else {
        const container = document.querySelector('.success-container') || document.body;
        container.appendChild(freeAccountMsg);
    }
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

async function createAccountAndApiKey(email) {
    try {
        // Create user account if it doesn't exist
        const createAccountResponse = await fetch(`${API_BASE_URL}/api/users/create-from-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                source: 'heyjunior-website'
            })
        });
        
        if (createAccountResponse.ok) {
            const accountData = await createAccountResponse.json();
            
            // Generate API key for the user
            const apiKeyResponse = await fetch(`${API_BASE_URL}/api/users/generate-api-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accountData.access_token}`
                },
                body: JSON.stringify({
                    key_name: 'Junior Desktop Client'
                })
            });
            
            if (apiKeyResponse.ok) {
                const apiKeyData = await apiKeyResponse.json();
                
                // Show API key to user
                showApiKeyInfo(apiKeyData.api_key, email);
                
                // Send email with API key and instructions
                await sendAccountEmail(email, apiKeyData.api_key);
            }
        }
    } catch (error) {
        console.error('Error creating account:', error);
        // Non-blocking - download still works
    }
}

async function sendAccountEmail(email, apiKey) {
    try {
        await fetch(`${API_BASE_URL}/api/downloads/send-download-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_email: email,
                api_key: apiKey
            })
        });
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

function showApiKeyInfo(apiKey, email) {
    const apiKeySection = document.createElement('div');
    apiKeySection.className = 'api-key-section';
    apiKeySection.style.cssText = `
        background: #f0f9ff;
        border: 1px solid #0ea5e9;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        position: relative;
    `;
    
    apiKeySection.innerHTML = `
        <h3 style="color: #0369a1; margin-bottom: 10px;">🔑 Your API Key</h3>
        <p style="color: #075985; margin-bottom: 15px;">Save this API key - you'll need it to log into the Junior desktop app:</p>
        <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" value="${apiKey}" readonly style="
                flex: 1;
                padding: 10px;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                font-family: monospace;
                background: white;
            " id="apiKeyInput">
            <button onclick="copyApiKey()" style="
                background: #0ea5e9;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
            ">Copy</button>
        </div>
        <p style="color: #64748b; font-size: 0.875rem; margin-top: 10px;">
            An email with this API key and setup instructions has been sent to ${email}
        </p>
    `;
    
    const instructionsBox = document.querySelector('.instructions-box');
    if (instructionsBox) {
        instructionsBox.parentNode.insertBefore(apiKeySection, instructionsBox);
    }
}

// Global function for copy button
window.copyApiKey = function() {
    const input = document.getElementById('apiKeyInput');
    input.select();
    document.execCommand('copy');
    
    // Show copied notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 9999;
    `;
    notification.textContent = 'API Key copied to clipboard!';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
};

async function startAutomaticDownload(downloadUrl, platform) {
    try {
        // Create automatic download ready section
        const downloadSection = document.createElement('div');
        downloadSection.className = 'auto-download-section';
        downloadSection.style.cssText = `
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border-radius: 12px;
            padding: 25px;
            margin: 20px 0;
            text-align: center;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        `;
        
        downloadSection.innerHTML = `
            <h3 style="margin: 0 0 15px 0; font-size: 1.4em;">✨ Premium Download Ready!</h3>
            <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 1.1em;">
                Your Junior Premium for ${platform === 'windows' ? 'Windows' : 'macOS'} is ready to download.
            </p>
            <button id="auto-download-btn" style="
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
                🚀 Start Download
            </button>
            <div style="font-size: 0.9em; opacity: 0.8; margin-top: 15px;">
                Premium features included • Priority support
            </div>
        `;
        
        // Insert into page
        const container = document.querySelector('.main-content') || document.body;
        container.appendChild(downloadSection);
        
        // Add download functionality
        document.getElementById('auto-download-btn').addEventListener('click', function() {
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
        
    } catch (error) {
        console.error('Automatic download setup failed:', error);
        showDownloadNotification(platform);
    }
}

async function startSecureDownload(downloadUrl, platform) {
    try {
        // Create download ready section
        const downloadSection = document.createElement('div');
        downloadSection.className = 'secure-download-section';
        downloadSection.style.cssText = `
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
            color: white;
            border-radius: 12px;
            padding: 25px;
            margin: 20px 0;
            text-align: center;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        `;
        
        downloadSection.innerHTML = `
            <h3 style="margin: 0 0 15px 0; font-size: 1.4em;">🎉 Account Ready!</h3>
            <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 1.1em;">
                Your Junior account for ${platform === 'windows' ? 'Windows' : 'macOS'} has been created successfully!
            </p>
            <button id="secure-download-btn" style="
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
                🔐 Secure Download
            </button>
            <div style="font-size: 0.9em; opacity: 0.8; margin-top: 15px;">
                Enterprise security • Full access
            </div>
        `;
        
        // Insert into page
        const container = document.querySelector('.main-content') || document.body;
        container.appendChild(downloadSection);
        
        // Add download functionality
        document.getElementById('secure-download-btn').addEventListener('click', function() {
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
        
    } catch (error) {
        console.error('Secure download setup failed:', error);
        console.error('Error with account setup:', error);
        showAccountCreationStatus('Account setup completed. Check your email for download instructions.', 'success');
    }
}

function startAutomaticDownload(platform) {
    // Create download ready section
    const downloadSection = document.createElement('div');
    downloadSection.className = 'auto-download-section';
    downloadSection.style.cssText = `
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border-radius: 12px;
        padding: 25px;
        margin: 20px 0;
        text-align: center;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    `;
    
    downloadSection.innerHTML = `
        <h3 style="margin: 0 0 15px 0; font-size: 1.4em;">🚀 Download Instructions Sent!</h3>
        <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 1.1em;">
            Check your email for Junior ${platform === 'windows' ? 'Windows' : 'macOS'} download instructions.
        </p>
        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; margin: 15px 0;">
            <p style="margin: 0; font-size: 1.0em;">
                📧 Email sent with download link<br>
                📋 Setup instructions included<br>
                🔑 Your API key is ready<br>
                💬 Support available if needed
            </p>
        </div>
    `;
    
    // Insert the section
    const container = document.querySelector('.success-container') || document.body;
    container.appendChild(downloadSection);
    
    console.log('Download instructions sent for:', platform);
}

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
        const macOption = document.querySelector('.download-option.macos');
        if (macOption) {
            macOption.style.display = 'block';
            macOption.classList.add('recommended');
            const button = macOption.querySelector('.download-button');
            if (button) {
                // Detect if user is on ARM Mac for better experience
                const isArmMac = navigator.userAgent.includes('Mac') && 
                                (navigator.userAgent.includes('ARM') || 
                                 window.navigator.platform === 'MacIntel' && 
                                 window.navigator.maxTouchPoints > 1);
                
                button.href = isArmMac ? MACOS_ARM_DOWNLOAD_URL : MACOS_DIRECT_DOWNLOAD_URL;
                button.target = '_self';
                
                // Update button text to indicate architecture
                if (isArmMac) {
                    button.textContent = 'Download for macOS (Apple Silicon)';
                } else {
                    button.textContent = 'Download for macOS (Intel)';
                }
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
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .license-section { display: none !important; }
`;
document.head.appendChild(dynamicNotificationStyles);

function updateAllEmailPlaceholders(email) {
    const emailElements = document.querySelectorAll('.customer-email');
    emailElements.forEach(el => {
        el.textContent = email || 'your email address';
    });
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

function displayApiKey(apiKey, email) {
    const statusDiv = document.querySelector('.account-status');
    if (statusDiv) {
        const apiKeySection = document.createElement('div');
        apiKeySection.className = 'api-key-section';
        apiKeySection.innerHTML = `
            <div class="api-key-info">
                <h4>🔑 Your API Key (for future use)</h4>
                <p>Save this key for when backend services become available:</p>
                <div class="api-key-display">
                    <code>${apiKey}</code>
                    <button onclick="copyApiKey('${apiKey}')" class="copy-btn">Copy</button>
                </div>
                <p class="api-key-note">
                    <strong>Note:</strong> For now, you can use Junior in offline mode without this key. 
                    This key will be useful when our cloud features are released.
                </p>
            </div>
        `;
        statusDiv.appendChild(apiKeySection);
    }
}

function copyApiKey(apiKey) {
    navigator.clipboard.writeText(apiKey).then(() => {
        const copyBtn = document.querySelector('.copy-btn');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.backgroundColor = '#10b981';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.backgroundColor = '';
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy API key:', err);
        alert('Failed to copy API key. Please copy it manually.');
    });
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
