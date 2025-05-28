// Success page functionality
const API_BASE_URL = 'https://junior-api-915940312680.us-west1.run.app';

// Download URLs (kept for manual download buttons, but primary instruction is email)
const WINDOWS_DOWNLOAD_URL = 'https://github.com/Andrew-AI-JR/heyjunior-website/releases/download/v3.1.0-beta/LinkedIn_Automation_Tool_v3.1.0-beta.zip';
const MACOS_DOWNLOAD_URL_GITHUB_ACTIONS = 'https://github.com/amalinow1973/linkedin-automation-tool/actions/workflows/build-macos.yml';

// Secure download endpoints (GCP-based)
const SECURE_DOWNLOAD_API = `${API_BASE_URL}/api/downloads`;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get('email');
const paymentIntentId = urlParams.get('payment_intent');

// Track if download has been triggered to prevent multiple downloads
let downloadTriggered = false;
let downloadToken = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const checkoutDataStr = sessionStorage.getItem('checkoutData');
    
    if (!checkoutDataStr) {
        // No checkout data (e.g., user landed here directly)
        // Optionally, attempt to get info from URL params if Stripe passes any (e.g., client_reference_id)
        // For now, redirect to checkout if critical info is missing.
        // alert('Session expired or invalid access. Redirecting to checkout...');
        // window.location.href = 'checkout.html';
        // return; 
        // For now, let's try to proceed gracefully and show a generic message if data is missing
        // This handles cases where Stripe redirects but session storage might be cleared by browser settings
        displayOrderInfo({ 
            email: 'your email address', 
            platform: 'your selected platform',
            error: 'Your payment was successful. Please check your email for your license key and download instructions.' 
        });
        // Hide sections that require specific data if it's missing
        const licenseSection = document.querySelector('.license-section');
        if (licenseSection) licenseSection.style.display = 'none';
        return;
    }
    
    const checkoutData = JSON.parse(checkoutDataStr);
    
    // Clear session storage once data is retrieved
    // sessionStorage.removeItem('checkoutData'); // Keep for now if user refreshes

    displayOrderInfo(checkoutData);

    // No automatic download; user will be instructed to check email.
    // We can still prepare download buttons if they want to click manually,
    // but the license key comes via email.
    updateDownloadButtons(checkoutData.platform);
});

function displayOrderInfo(data) {
    // Update email
    const emailElements = document.querySelectorAll('.customer-email');
    emailElements.forEach(el => {
        el.textContent = data.email || 'your email address';
    });
    
    // Update platform
    const platformElements = document.querySelectorAll('.selected-platform');
    platformElements.forEach(el => {
        if (data.platform) {
            el.textContent = data.platform === 'windows' ? 'Windows' : 'macOS';
        } else {
            el.textContent = 'your selected platform';
        }
    });
    
    // Remove or hide the old license key display section
    const licenseSection = document.querySelector('.license-section');
    if (licenseSection) {
        licenseSection.style.display = 'none'; // Hide it as license key comes via email
    }

    // Display a prominent message about email delivery
    const paymentStatusDiv = document.querySelector('.payment-status');
    if (paymentStatusDiv) {
        const emailMessage = document.createElement('div');
        emailMessage.className = 'email-delivery-notice';
        emailMessage.style.background = '#e0f2fe';
        emailMessage.style.border = '1px solid #7dd3fc';
        emailMessage.style.borderRadius = '8px';
        emailMessage.style.padding = '20px';
        emailMessage.style.margin = '20px 0';
        emailMessage.style.textAlign = 'center';
        emailMessage.innerHTML = `
            <h3 style="color: #0c4a6e; margin-bottom: 10px;">🎉 Your Order is Confirmed!</h3>
            <p style="color: #075985; margin-bottom: 5px;">Thank you for your purchase.</p>
            <p style="color: #075985; font-weight: bold;">Your license key and detailed download/installation instructions will be sent to <strong>${data.email || 'your email address'}</strong> shortly.</p>
            <p style="color: #075985; margin-top: 10px;">Please check your inbox (and spam folder, just in case!).</p>
        `;
        // Prepend this message to the payment status or a more suitable container
        const successHeader = document.querySelector('.success-header');
        if (successHeader) {
            successHeader.insertAdjacentElement('afterend', emailMessage);
        } else {
            paymentStatusDiv.prepend(emailMessage);
        }
    }
    
    if (data.error) { // If there was an error passed from checkout (e.g. order processing delayed)
        showDelayedProcessing(data.error);
    }
}

// This function is kept for explicit error messages if needed, though primary confirmation is above.
function showDelayedProcessing(message) {
    const delayedMessageContainer = document.querySelector('.payment-status'); // Or another suitable container
    if (delayedMessageContainer) {
        const delayedMessage = document.createElement('div');
        delayedMessage.className = 'delayed-processing-message';
        delayedMessage.innerHTML = `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                <h4 style="color: #856404; margin-bottom: 8px;">⏳ Important Notice</h4>
                <p style="color: #856404; margin: 0;">${message}</p>
            </div>
        `;
        delayedMessageContainer.appendChild(delayedMessage);
    }
}

function updateDownloadButtons(platform) {
    document.querySelectorAll('.download-option').forEach(option => {
        option.style.display = 'none'; // Hide all first
    });

    const selectedPlatform = platform || (Math.random() < 0.5 ? 'windows' : 'macos'); // Fallback for display if platform unknown

    if (selectedPlatform === 'windows') {
        const windowsOption = document.querySelector('.download-option.windows');
        if (windowsOption) {
            windowsOption.style.display = 'block';
            windowsOption.classList.add('recommended');
            // Update link if needed, though direct link is in HTML
            windowsOption.querySelector('.download-button').href = WINDOWS_DOWNLOAD_URL;
        }
    } else { // macOS or unknown defaults to macOS display
        const macOption = document.querySelector('.download-option.macos');
        if (macOption) {
            macOption.style.display = 'block';
            macOption.classList.add('recommended');
            // Update link for GitHub Actions - this link takes user to a page, not direct download
            macOption.querySelector('.download-button').href = MACOS_DOWNLOAD_URL_GITHUB_ACTIONS;
            macOption.querySelector('.download-button').target = '_blank'; // Open GitHub in new tab
        }
    }
    updateInstructions(selectedPlatform);
}

function updateInstructions(platform) {
    const instructionsBox = document.querySelector('.instructions-box');
    if (!instructionsBox) return;
    
    const commonInstructions = `
        <p><strong>Important:</strong> Your unique license key is required to activate and use the software. 
        This has been sent to your email address: <strong class="customer-email">${sessionStorage.getItem('checkoutData') ? JSON.parse(sessionStorage.getItem('checkoutData')).email : 'your email'}</strong>.</p>
        <p>Please check your email (including the spam/junk folder) for the message containing your license key and full setup guide.</p>
    `;

    if (platform === 'windows') {
        instructionsBox.innerHTML = `
            <h3>🖥️ Windows Installation</h3>
            ${commonInstructions}
            <ol>
                <li>Once you receive your license key via email, you can download the software using the button above.</li>
                <li>Locate the downloaded ZIP file (e.g., in your Downloads folder).</li>
                <li>Right-click the ZIP file and select "Extract All".</li>
                <li>Open the extracted folder and run "LinkedIn_Automation_Tool.exe".</li>
                <li>During setup, you will be prompted to enter the license key sent to your email.</li>
                <li>Follow the on-screen prompts to complete the installation.</li>
            </ol>
            <p><small><strong>Note:</strong> Windows Defender SmartScreen might show a warning. If so, click "More info" then "Run anyway".</small></p>
        `;
    } else { // macOS
        instructionsBox.innerHTML = `
            <h3>🍎 macOS Installation</h3>
            ${commonInstructions}
            <ol>
                <li>Once you receive your license key via email, you can find the macOS software. The button above links to our GitHub Actions page where you can download the latest macOS build (DMG file from "Artifacts").</li>
                <li>Open the downloaded DMG file.</li>
                <li>Drag the "LinkedIn Automation Tool" icon to your Applications folder.</li>
                <li>Open the app from your Applications folder. The first time, you may need to right-click the app icon and select "Open".</li>
                <li>When prompted, enter the license key that was emailed to you.</li>
                <li>Grant any necessary permissions if macOS asks.</li>
            </ol>
            <p><small><strong>Note:</strong> If macOS blocks the app ("unidentified developer"), go to System Settings > Privacy & Security, scroll down and click "Open Anyway".</small></p>
        `;
    }
    // Re-populate email in instructions if it was updated
    const emailInInstructions = instructionsBox.querySelectorAll('.customer-email');
    emailInInstructions.forEach(el => {
         el.textContent = sessionStorage.getItem('checkoutData') ? JSON.parse(sessionStorage.getItem('checkoutData')).email : 'your email address';
    });
}

// CSS for email delivery notice (can be moved to styles.css)
const dynamicStyle = document.createElement('style');
dynamicStyle.textContent = `
    .email-delivery-notice {
        animation: fadeIn 0.5s ease-out;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* Hide elements that are no longer relevant */
    .license-section { /* This class was for the old direct license display */
        display: none !important;
    }
`;
document.head.appendChild(dynamicStyle);

// Ensure all .customer-email placeholders are updated
function updateAllEmailPlaceholders(email) {
    const emailElements = document.querySelectorAll('.customer-email');
    emailElements.forEach(el => {
        el.textContent = email || 'your email address';
    });
}

// Initial call to update placeholders, in case checkoutData was available early
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
