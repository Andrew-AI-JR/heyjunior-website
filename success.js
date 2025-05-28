// Success page functionality
const API_BASE_URL = 'https://junior-api-915940312680.us-west1.run.app';

// Download URLs
const WINDOWS_DOWNLOAD_URL = 'https://github.com/Andrew-AI-JR/heyjunior-website/releases/download/v3.1.0-beta/LinkedIn_Automation_Tool_v3.1.0-beta.zip';
const MACOS_DOWNLOAD_URL = 'https://github.com/amalinow1973/linkedin-automation-tool/actions/workflows/build-macos.yml'; // macOS v3.1.0-beta via GitHub Actions

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
    // Get order data from session storage
    const orderDataStr = sessionStorage.getItem('orderData');
    
    if (!orderDataStr) {
        // No order data - redirect to checkout
        window.location.href = 'checkout.html';
        return;
    }
    
    const orderData = JSON.parse(orderDataStr);
    
    // Clear session storage
    sessionStorage.removeItem('orderData');
    
    // Display order information
    displayOrderInfo(orderData);
    
    // Start automatic download if no error
    if (!orderData.error) {
        setTimeout(() => {
            startAutomaticDownload(orderData.platform);
        }, 1500); // Small delay for user to see success message
    }
});

function displayOrderInfo(orderData) {
    // Update email
    const emailElements = document.querySelectorAll('.customer-email');
    emailElements.forEach(el => {
        el.textContent = orderData.email;
    });
    
    // Update platform
    const platformElements = document.querySelectorAll('.selected-platform');
    platformElements.forEach(el => {
        el.textContent = orderData.platform === 'windows' ? 'Windows' : 'macOS';
    });
    
    // Display license key if available
    if (orderData.license_key) {
        displayLicenseKey(orderData.license_key);
    } else if (orderData.error) {
        // Show error message
        showDelayedProcessing(orderData.error);
    }
    
    // Update download buttons based on platform
    updateDownloadButtons(orderData.platform);
}

function displayLicenseKey(licenseKey) {
    // Update license key display
    const licenseKeyElement = document.getElementById('license-key-display');
    if (licenseKeyElement) {
        licenseKeyElement.textContent = licenseKey;
    }
    
    // Show license section
    const licenseSection = document.querySelector('.license-section');
    if (licenseSection) {
        licenseSection.style.display = 'block';
    }
    
    // Add copy functionality
    const copyButton = document.getElementById('copy-license-key');
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            copyLicenseKey(licenseKey);
        });
    }
}

function copyLicenseKey(licenseKey) {
    navigator.clipboard.writeText(licenseKey).then(() => {
        // Show success message
        const copyButton = document.getElementById('copy-license-key');
        const originalText = copyButton.textContent;
        copyButton.textContent = '✅ Copied!';
        copyButton.style.background = '#10b981';
        
        setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy. Please select and copy manually.');
    });
}

function showDelayedProcessing(message) {
    const delayedMessage = document.createElement('div');
    delayedMessage.className = 'delayed-processing-message';
    delayedMessage.innerHTML = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="color: #856404; margin-bottom: 10px;">⏳ Processing Your Order</h3>
            <p style="color: #856404; margin: 0;">${message}</p>
        </div>
    `;
    
    const paymentStatus = document.querySelector('.payment-status');
    if (paymentStatus) {
        paymentStatus.appendChild(delayedMessage);
    }
}

function updateDownloadButtons(platform) {
    // Hide all download options first
    document.querySelectorAll('.download-option').forEach(option => {
        option.style.display = 'none';
    });
    
    // Show the selected platform
    if (platform === 'windows') {
        const windowsOption = document.querySelector('.download-option.windows');
        if (windowsOption) {
            windowsOption.style.display = 'block';
            windowsOption.classList.add('recommended');
        }
    } else {
        const macOption = document.querySelector('.download-option.macos');
        if (macOption) {
            macOption.style.display = 'block';
            macOption.classList.add('recommended');
        }
    }
    
    // Update instructions
    updateInstructions(platform);
}

function updateInstructions(platform) {
    const instructionsBox = document.querySelector('.instructions-box');
    if (!instructionsBox) return;
    
    if (platform === 'windows') {
        instructionsBox.innerHTML = `
            <h3>🖥️ Windows Installation Instructions</h3>
            <ol>
                <li>Your download should start automatically. If not, click the download button above.</li>
                <li>Locate the downloaded ZIP file (usually in your Downloads folder)</li>
                <li>Right-click the ZIP file and select "Extract All"</li>
                <li>Open the extracted folder and run "LinkedIn_Automation_Tool.exe"</li>
                <li>When prompted, enter your license key (sent to your email)</li>
                <li>Follow the setup wizard to complete installation</li>
            </ol>
            <p><strong>Note:</strong> Windows may show a security warning. Click "More info" then "Run anyway" to proceed.</p>
        `;
    } else {
        instructionsBox.innerHTML = `
            <h3>🍎 macOS Installation Instructions</h3>
            <ol>
                <li>Your download should start automatically. If not, click the download button above.</li>
                <li>Open the downloaded DMG file</li>
                <li>Drag the LinkedIn Automation Tool to your Applications folder</li>
                <li>Open the app from Applications (you may need to right-click and select "Open" the first time)</li>
                <li>When prompted, enter your license key (sent to your email)</li>
                <li>Grant necessary permissions when asked</li>
            </ol>
            <p><strong>Note:</strong> If macOS blocks the app, go to System Preferences > Security & Privacy and click "Open Anyway".</p>
        `;
    }
}

function startAutomaticDownload(platform) {
    // Show download notification
    showDownloadNotification(platform);
    
    if (platform === 'windows') {
        // Download Windows version
        const downloadUrl = 'https://github.com/amalinow1973/linkedin-automation-tool/releases/download/v3.1.0-beta/LinkedIn_Automation_Tool_v3.1.0-beta.zip';
        startDownload(downloadUrl, 'LinkedIn_Automation_Tool_v3.1.0-beta.zip');
    } else {
        // For macOS, check if DMG is available via API first
        checkMacOSDownload();
    }
}

async function checkMacOSDownload() {
    try {
        // Check if secure download is available
        const response = await fetch('https://junior-api-915940312680.us-west1.run.app/api/v1/downloads/check-availability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                platform: 'macos',
                version: 'v3.1.0-beta'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.available && data.download_url) {
                startDownload(data.download_url, 'LinkedIn_Automation_Tool_v3.1.0-beta_macOS.dmg');
                return;
            }
        }
    } catch (error) {
        console.error('Error checking macOS download:', error);
    }
    
    // Fallback to GitHub Actions
    const githubUrl = 'https://github.com/amalinow1973/linkedin-automation-tool/actions/workflows/build-macos.yml';
    showMacOSInstructions(githubUrl);
}

function startDownload(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showDownloadNotification(platform) {
    const notification = document.createElement('div');
    notification.className = 'download-notification';
    notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 1000; animation: slideIn 0.3s ease-out;">
            <h4 style="margin: 0 0 5px 0;">✅ Download Started!</h4>
            <p style="margin: 0; font-size: 0.9rem;">Your ${platform === 'windows' ? 'Windows' : 'macOS'} download has begun...</p>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 5000);
}

function showMacOSInstructions(githubUrl) {
    const instructionsModal = document.createElement('div');
    instructionsModal.className = 'macos-instructions-modal';
    instructionsModal.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 1000; max-width: 500px;">
            <h3 style="color: #1f2937; margin-bottom: 15px;">🍎 macOS Download Instructions</h3>
            <p style="color: #4b5563; margin-bottom: 20px;">The macOS version is being built. Please follow these steps:</p>
            <ol style="color: #4b5563; margin-bottom: 20px;">
                <li>Click the button below to go to GitHub Actions</li>
                <li>Look for the latest successful build</li>
                <li>Download the DMG file from the artifacts section</li>
            </ol>
            <a href="${githubUrl}" target="_blank" class="primary-button" style="display: inline-block; width: 100%; text-align: center; margin-bottom: 10px;">Go to GitHub Actions</a>
            <button onclick="this.parentElement.parentElement.remove()" style="background: #f3f4f6; color: #4b5563; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; width: 100%;">Close</button>
        </div>
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999;" onclick="this.parentElement.remove()"></div>
    `;
    
    document.body.appendChild(instructionsModal);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .license-section {
        background: #f0f9ff;
        border: 2px solid #3b82f6;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
    }
    
    #license-key-display {
        font-family: monospace;
        font-size: 1.2rem;
        background: white;
        padding: 15px;
        border-radius: 6px;
        margin: 15px 0;
        word-break: break-all;
        user-select: all;
    }
    
    #copy-license-key {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    #copy-license-key:hover {
        background: #2563eb;
        transform: translateY(-1px);
    }
`;
document.head.appendChild(style);

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
