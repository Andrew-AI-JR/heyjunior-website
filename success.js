// Success page functionality with Account Creation Integration
const API_BASE_URL = 'https://junior-api-915940312680.us-west1.run.app';

// Download URLs (fallback for direct download if API fails)
const WINDOWS_DIRECT_DOWNLOAD_URL = 'downloads/LinkedIn_Automation_Tool_v3.0.1-beta.zip';
const MACOS_DIRECT_DOWNLOAD_URL = 'https://drive.google.com/uc?export=download&id=1Q0AuZYSlMealm5B-iDEhO5oW1VO7x8dM';

// Track download and account status
let accountCreationComplete = false;
let downloadToken = null;
let accountCheckAttempts = 0;
const MAX_ACCOUNT_CHECK_ATTEMPTS = 30; // 30 attempts over 5 minutes

document.addEventListener('DOMContentLoaded', async () => {
    // Get checkout data from session/localStorage
    const checkoutDataStr = sessionStorage.getItem('checkoutData') || localStorage.getItem('pendingAccountCreation');
    let email = 'your email address';
    let platform = 'your selected platform';

    if (checkoutDataStr) {
        try {
            const checkoutData = JSON.parse(checkoutDataStr);
            email = checkoutData.email || email;
            platform = checkoutData.platform || platform;
            
            // Clear the pending account creation data
            localStorage.removeItem('pendingAccountCreation');
            
            app_logger.info(`Processing success page for ${email}, platform: ${platform}`);
        } catch (error) {
            console.warn('Error parsing checkout data:', error);
        }
    }

    // Display initial order info
    displayOrderInfo(email, platform);
    updateDownloadButtons(platform);
    updateInstructions(platform, email);

    // Check account creation status and handle download
    if (email !== 'your email address') {
        await handleAccountCreationAndDownload(email, platform);
    } else {
        // Fallback to direct download if no email
        setTimeout(() => startAutomaticDownload(platform), 2000);
    }
});

async function handleAccountCreationAndDownload(email, platform) {
    try {
        showAccountCreationStatus('Checking account status...', 'info');
        
        // Check if account creation is complete
        const accountStatus = await checkAccountStatus(email);
        
        if (accountStatus.account_exists && accountStatus.download_ready) {
            // Account is ready, generate download token
            showAccountCreationStatus('Account ready! Generating download link...', 'success');
            await generateAndUseDownloadToken(email, platform);
        } else if (accountStatus.account_exists && !accountStatus.download_ready) {
            // Account exists but subscription not ready
            showAccountCreationStatus('Account created, finalizing subscription...', 'info');
            await waitForSubscriptionActivation(email, platform);
        } else {
            // Account doesn't exist yet, wait for webhook processing
            showAccountCreationStatus('Creating your account...', 'info');
            await waitForAccountCreation(email, platform);
        }
    } catch (error) {
        console.error('Error in account creation flow:', error);
        showAccountCreationStatus('Account creation in progress. Starting download...', 'warning');
        // Fallback to direct download
        setTimeout(() => startAutomaticDownload(platform), 2000);
    }
}

async function checkAccountStatus(email) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payments/download-status/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn('Error checking account status:', error);
        return { account_exists: false, download_ready: false };
    }
}

async function generateAndUseDownloadToken(email, platform) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/accounts/generate-download-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_email: email,
                platform: platform
            })
        });
        
        if (response.ok) {
            const tokenData = await response.json();
            downloadToken = tokenData.download_token;
            
            showAccountCreationStatus('Download ready! Starting secure download...', 'success');
            
            // Start secure download with token
            await startSecureDownload(platform, downloadToken);
        } else {
            throw new Error(`Failed to generate download token: ${response.status}`);
        }
    } catch (error) {
        console.error('Error generating download token:', error);
        showAccountCreationStatus('Using direct download...', 'warning');
        startAutomaticDownload(platform);
    }
}

async function waitForAccountCreation(email, platform) {
    const checkInterval = setInterval(async () => {
        accountCheckAttempts++;
        
        if (accountCheckAttempts >= MAX_ACCOUNT_CHECK_ATTEMPTS) {
            clearInterval(checkInterval);
            showAccountCreationStatus('Account creation taking longer than expected. Starting download...', 'warning');
            startAutomaticDownload(platform);
            return;
        }
        
        const status = await checkAccountStatus(email);
        
        if (status.account_exists) {
            clearInterval(checkInterval);
            
            if (status.download_ready) {
                await generateAndUseDownloadToken(email, platform);
            } else {
                await waitForSubscriptionActivation(email, platform);
            }
        } else {
            // Update status message
            const remainingAttempts = MAX_ACCOUNT_CHECK_ATTEMPTS - accountCheckAttempts;
            showAccountCreationStatus(
                `Creating your account... (${Math.ceil(remainingAttempts / 6)} minutes remaining)`, 
                'info'
            );
        }
    }, 10000); // Check every 10 seconds
}

async function waitForSubscriptionActivation(email, platform) {
    const checkInterval = setInterval(async () => {
        const status = await checkAccountStatus(email);
        
        if (status.download_ready) {
            clearInterval(checkInterval);
            await generateAndUseDownloadToken(email, platform);
        }
    }, 5000); // Check every 5 seconds
    
    // Timeout after 2 minutes
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!accountCreationComplete) {
            showAccountCreationStatus('Subscription activation taking longer than expected. Starting download...', 'warning');
            startAutomaticDownload(platform);
        }
    }, 120000);
}

async function startSecureDownload(platform, token) {
    try {
        // TODO: Implement secure download with token
        // For now, fall back to direct download
        showDownloadNotification(platform);
        startAutomaticDownload(platform);
        accountCreationComplete = true;
    } catch (error) {
        console.error('Error with secure download:', error);
        startAutomaticDownload(platform);
    }
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

function displayOrderInfo(email, platform) {
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
            if (button) button.href = WINDOWS_DIRECT_DOWNLOAD_URL;
        }
    } else { 
        const macOption = document.querySelector('.download-option.macos');
        if (macOption) {
            macOption.style.display = 'block';
            macOption.classList.add('recommended');
            const button = macOption.querySelector('.download-button');
            if (button) {
                button.href = MACOS_DIRECT_DOWNLOAD_URL;
                button.target = '_self';
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

function startAutomaticDownload(platform) {
    let downloadUrl = '';
    let filename = '';

    if (platform === 'windows') {
        downloadUrl = WINDOWS_DIRECT_DOWNLOAD_URL;
        filename = 'LinkedIn_Automation_Tool_v3.0.1-beta.zip';
    } else if (platform === 'macos') {
        downloadUrl = MACOS_DIRECT_DOWNLOAD_URL;
        filename = 'LinkedIn_Automation_Tool_macOS_beta.dmg';
    } else {
        console.warn('Unknown platform for automatic download:', platform);
        return;
    }

    if (downloadUrl) {
        showDownloadNotification(platform);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('Attempting automatic download for:', platform, 'from:', downloadUrl);
    }
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
    `;
    document.head.appendChild(style);
} 
