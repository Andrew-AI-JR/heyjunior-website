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

document.addEventListener('DOMContentLoaded', function() {
    // Update success message
    document.querySelector('#customer-email').textContent = email || 'your email';
    
    // Verify payment if payment intent ID is present
    if (paymentIntentId) {
        verifyPaymentStatus();
    }
    
    // Set up download buttons
    setupDownloadButtons();
    
    // Add license display
    addLicenseStyles();
    displayLicenseInfo();
});

async function verifyPaymentStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/payments/verify-payment`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                payment_intent_id: paymentIntentId,
                customer_email: email
            })
        });

        if (response.ok) {
            const paymentData = await response.json();
            console.log('✅ Payment verified:', paymentData);
            
            // Generate secure download token
            await generateDownloadToken();
            
            // Show verified payment status
            updatePaymentStatus('verified');
            
            // Trigger automatic download after payment verification
            triggerAutomaticDownload();
        } else {
            console.warn('⚠️ Payment verification failed');
            updatePaymentStatus('unverified');
        }
    } catch (error) {
        console.error('❌ Payment verification error:', error);
        updatePaymentStatus('error');
    }
}

async function generateDownloadToken() {
    try {
        const response = await fetch(`${SECURE_DOWNLOAD_API}/generate-token`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                customer_email: email,
                payment_intent_id: paymentIntentId,
                platform: navigator.platform,
                user_agent: navigator.userAgent
            })
        });

        if (response.ok) {
            const tokenData = await response.json();
            downloadToken = tokenData.download_token;
            console.log('🔑 Download token generated');
        } else {
            console.warn('⚠️ Could not generate download token, falling back to public downloads');
        }
    } catch (error) {
        console.warn('⚠️ Download token generation failed:', error);
    }
}

function triggerAutomaticDownload() {
    // Prevent multiple downloads
    if (downloadTriggered) return;
    downloadTriggered = true;
    
    // Detect user's operating system
    const userAgent = navigator.userAgent.toLowerCase();
    const isMac = userAgent.includes('mac');
    const isWindows = userAgent.includes('win');
    
    // Show download notification
    showDownloadNotification();
    
    // Trigger download based on OS
    if (isWindows) {
        // Auto-download for Windows
        setTimeout(() => {
            startWindowsDownload();
        }, 2000); // 2 second delay to show notification
    } else if (isMac) {
        // For macOS, use secure download if token available, otherwise show instructions
        setTimeout(() => {
            if (downloadToken) {
                startSecureMacOSDownload();
            } else {
                showMacOSAutoInstructions();
            }
        }, 2000);
    } else {
        // For other OS, show both options
        setTimeout(() => {
            showDownloadOptions();
        }, 2000);
    }
}

async function startSecureMacOSDownload() {
    // Show auto-download indicator
    const indicator = document.getElementById('macos-auto-indicator');
    if (indicator) {
        indicator.style.display = 'block';
        indicator.innerHTML = '<span class="pulse-dot"></span>Preparing secure download...';
    }
    
    try {
        // Request secure macOS download
        const response = await fetch(`${SECURE_DOWNLOAD_API}/macos`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                download_token: downloadToken,
                customer_email: email
            })
        });

        if (response.ok) {
            const downloadData = await response.json();
            
            if (downloadData.download_url) {
                // Update indicator
                if (indicator) {
                    indicator.innerHTML = '<span class="pulse-dot"></span>Starting download...';
                }
                
                // Start secure download
                const downloadLink = document.createElement('a');
                downloadLink.href = downloadData.download_url;
                downloadLink.download = downloadData.filename || 'LinkedIn_Automation_Tool_v3.1.0-beta_macOS.dmg';
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // Track the download
                trackDownload('macos-secure-auto');
                
                // Show macOS instructions
                showSecureMacOSInstructions(downloadData);
                
                // Update notification
                updateDownloadNotification('Secure macOS download started! Check your Downloads folder.');
            } else {
                throw new Error('No download URL provided');
            }
        } else {
            throw new Error(`Download request failed: ${response.status}`);
        }
    } catch (error) {
        console.warn('Secure download failed, falling back to GitHub Actions:', error);
        showMacOSAutoInstructions();
    } finally {
        // Hide indicator after 3 seconds
        setTimeout(() => {
            if (indicator) {
                indicator.style.display = 'none';
            }
        }, 3000);
    }
}

function showSecureMacOSInstructions(downloadData) {
    const instructionsDiv = document.querySelector('#download-instructions');
    if (instructionsDiv) {
        instructionsDiv.innerHTML = `
            <div class="instructions-box">
                <h3>📥 macOS Installation v3.1.0-beta (Secure Download)</h3>
                <p>✅ Your secure macOS download has started automatically!</p>
                
                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 10px; margin: 10px 0;">
                    <strong>🔒 Secure Download:</strong> This is a personalized download link tied to your purchase.
                    <br>File: ${downloadData.filename || 'LinkedIn_Automation_Tool_v3.1.0-beta_macOS.dmg'}
                    <br>Valid until: ${downloadData.expires_at || 'N/A'}
                </div>
                
                <h4>🎯 Installation Steps:</h4>
                <ol>
                    <li>Wait for the DMG file to finish downloading</li>
                    <li>Double-click the DMG file to mount it</li>
                    <li>Drag the app to your Applications folder</li>
                    <li>Right-click the app and select "Open" (first time only)</li>
                    <li>🔑 Enter your license key when prompted (check your email or copy from above)</li>
                    <li>Follow the setup wizard instructions</li>
                    <li>Configure your LinkedIn credentials</li>
                    <li>Start with conservative automation settings!</li>
                </ol>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 10px; margin: 10px 0;">
                    <strong>🔑 License Required:</strong> This version requires a valid license key to run automation features.
                    <br>Your license key should be displayed above or sent to your email.
                </div>
                
                <p><strong>Need help?</strong> Contact support at <a href="mailto:amalinow1973@gmail.com">amalinow1973@gmail.com</a></p>
            </div>
        `;
    }
}

function showDownloadNotification() {
    // Create and show download notification
    const notification = document.createElement('div');
    notification.id = 'download-notification';
    notification.innerHTML = `
        <div class="download-notification">
            <div class="notification-content">
                <h3>🎉 Payment Verified!</h3>
                <p>Your download will start automatically...</p>
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;
    
    // Add notification styles
    const style = document.createElement('style');
    style.textContent = `
        .download-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideIn 0.5s ease-out;
            max-width: 300px;
        }
        
        .notification-content h3 {
            margin: 0 0 10px 0;
            font-size: 1.2em;
        }
        
        .notification-content p {
            margin: 0 0 15px 0;
        }
        
        .loading-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
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
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
            .download-notification {
                top: 10px;
                right: 10px;
                left: 10px;
                max-width: none;
            }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function startWindowsDownload() {
    // Show auto-download indicator
    const indicator = document.getElementById('windows-auto-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }
    
    // Create invisible download link and trigger it
    const downloadLink = document.createElement('a');
    downloadLink.href = WINDOWS_DOWNLOAD_URL;
    downloadLink.download = 'LinkedIn_Automation_Tool_v3.1.0-beta.zip';
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Track the download
    trackDownload('windows-auto');
    
    // Show Windows instructions
    showWindowsInstructions();
    
    // Update notification
    updateDownloadNotification('Windows download started! Check your Downloads folder.');
    
    // Hide indicator after 3 seconds
    setTimeout(() => {
        if (indicator) {
            indicator.style.display = 'none';
        }
    }, 3000);
}

function showMacOSAutoInstructions() {
    // Show auto-download indicator
    const indicator = document.getElementById('macos-auto-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }
    
    // For macOS, we can't auto-download from GitHub Actions, so show instructions
    showMacOSInstructions();
    
    // Track the attempt
    trackDownload('macos-auto');
    
    // Update notification
    updateDownloadNotification('macOS instructions displayed below. Click the download link to proceed.');
    
    // Hide indicator after 3 seconds
    setTimeout(() => {
        if (indicator) {
            indicator.style.display = 'none';
        }
    }, 3000);
}

function showDownloadOptions() {
    // Show both download options for unknown OS
    const downloadSection = document.querySelector('.download-section');
    if (downloadSection) {
        downloadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Update notification
    updateDownloadNotification('Please select your operating system below to download.');
}

function updateDownloadNotification(message) {
    const notification = document.getElementById('download-notification');
    if (notification) {
        const content = notification.querySelector('.notification-content');
        content.innerHTML = `
            <h3>✅ Ready to Download</h3>
            <p>${message}</p>
        `;
        
        // Change notification color to success
        notification.querySelector('.download-notification').style.background = 
            'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }
}

function updatePaymentStatus(status) {
    const statusElement = document.querySelector('#payment-status');
    if (!statusElement) return;

    switch (status) {
        case 'verified':
            statusElement.innerHTML = `
                <h2>✅ Payment Verified!</h2>
                <p>Your payment has been confirmed and your beta access is active.</p>
                <p>Confirmation email sent to <span id="customer-email">${email}</span></p>
                <div class="auto-download-notice">
                    <p><strong>🚀 Your download will start automatically!</strong></p>
                </div>
            `;
            break;
        case 'unverified':
            statusElement.innerHTML = `
                <h2>⚠️ Payment Pending Verification</h2>
                <p>Your payment is being processed. You should receive confirmation shortly.</p>
                <p>If you don't receive confirmation within 10 minutes, please contact support.</p>
            `;
            break;
        case 'error':
            statusElement.innerHTML = `
                <h2>❌ Verification Error</h2>
                <p>Unable to verify payment status. Please contact support if you were charged.</p>
                <p>Email: <a href="mailto:amalinow1973@gmail.com">amalinow1973@gmail.com</a></p>
            `;
            break;
    }
}

function setupDownloadButtons() {
    // Detect user's operating system
    const userAgent = navigator.userAgent.toLowerCase();
    const isMac = userAgent.includes('mac');
    const isWindows = userAgent.includes('win');
    
    // Update the large download buttons with proper URLs and event listeners
    const windowsButton = document.querySelector('#windows-download-large');
    const macosButton = document.querySelector('#macos-download-large');
    
    if (windowsButton) {
        windowsButton.href = WINDOWS_DOWNLOAD_URL;
        windowsButton.addEventListener('click', function(e) {
            trackDownload('windows-manual');
            showWindowsInstructions();
        });
        
        // Add recommended badge for Windows users
        if (isWindows) {
            const windowsOption = document.querySelector('.windows-option');
            if (windowsOption && !windowsOption.querySelector('.recommended-badge')) {
                const badge = document.createElement('div');
                badge.className = 'recommended-badge';
                badge.textContent = 'Recommended for you';
                windowsOption.appendChild(badge);
                windowsOption.classList.add('recommended');
            }
        }
    }
    
    if (macosButton) {
        macosButton.href = MACOS_DOWNLOAD_URL;
        macosButton.addEventListener('click', function(e) {
            trackDownload('macos-manual');
            showMacOSInstructions();
        });
        
        // Add recommended badge for Mac users
        if (isMac) {
            const macosOption = document.querySelector('.macos-option');
            if (macosOption && !macosOption.querySelector('.recommended-badge')) {
                const badge = document.createElement('div');
                badge.className = 'recommended-badge';
                badge.textContent = 'Recommended for you';
                macosOption.appendChild(badge);
                macosOption.classList.add('recommended');
            }
        }
    }
}

function showWindowsInstructions() {
    const instructionsDiv = document.querySelector('#download-instructions');
    if (instructionsDiv) {
        instructionsDiv.innerHTML = `
            <div class="instructions-box">
                <h3>📥 Windows Installation v3.1.0-beta</h3>
                <p>Your download should begin automatically. If it doesn't:</p>
                <ol>
                    <li>Click the download button again</li>
                    <li>Or <a href="${WINDOWS_DOWNLOAD_URL}" target="_blank">click here</a></li>
                </ol>
                
                <h4>🎯 Installation Steps:</h4>
                <ol>
                    <li>Extract the ZIP file to a permanent location</li>
                    <li>Run the LinkedIn_Automation_Tool_v3.1.0-beta.exe file</li>
                    <li>🔑 Enter your license key when prompted (check your email or copy from above)</li>
                    <li>Follow the setup wizard instructions</li>
                    <li>Configure your LinkedIn credentials</li>
                    <li>Start with conservative automation settings!</li>
                </ol>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 10px; margin: 10px 0;">
                    <strong>🔑 License Required:</strong> This version requires a valid license key to run automation features.
                    <br>Your license key should be displayed above or sent to your email.
                </div>
                
                <p><strong>Need help?</strong> Check the installation guide included in the download.</p>
            </div>
        `;
    }
}

function showMacOSInstructions() {
    const instructionsDiv = document.querySelector('#download-instructions');
    if (instructionsDiv) {
        instructionsDiv.innerHTML = `
            <div class="instructions-box">
                <h3>📥 macOS Installation v3.1.0-beta</h3>
                <p>The macOS version v3.1.0-beta is available through GitHub Actions:</p>
                <ol>
                    <li>Click the link above to go to GitHub Actions</li>
                    <li>Look for the latest successful "Build LinkedIn Automation Tool v3.1.0-beta - macOS" workflow run</li>
                    <li>Click on the workflow run to view details</li>
                    <li>Scroll down to "Artifacts" section</li>
                    <li>Download the "linkedin-automation-macos-v3.1.0-beta" artifact</li>
                    <li>Unzip the downloaded file to get the DMG</li>
                </ol>
                
                <h4>🎯 Installation Steps:</h4>
                <ol>
                    <li>Double-click the DMG file to mount it</li>
                    <li>Drag the app to your Applications folder</li>
                    <li>Right-click the app and select "Open" (first time only)</li>
                    <li>🔑 Enter your license key when prompted (check your email or copy from above)</li>
                    <li>Follow the setup wizard instructions</li>
                    <li>Configure your LinkedIn credentials</li>
                    <li>Start with conservative automation settings!</li>
                </ol>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 10px; margin: 10px 0;">
                    <strong>🔑 License Required:</strong> This version requires a valid license key to run automation features.
                    <br>Your license key should be displayed above or sent to your email.
                </div>
                
                <p><strong>Need help?</strong> Contact support at <a href="mailto:amalinow1973@gmail.com">amalinow1973@gmail.com</a></p>
            </div>
        `;
    }
}

function trackDownload(platform) {
    console.log(`🔄 Download started: ${platform}`);
    
    // Google Analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', 'download', {
            'event_category': 'Beta Release',
            'event_label': `v3.1.0-beta-${platform}`,
            'value': 1
        });
    }
    
    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Download', {
            content_name: `LinkedIn Automation Tool Beta - ${platform}`,
            content_type: 'product',
            content_ids: [`v3.1.0-beta-${platform}`]
        });
    }
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
