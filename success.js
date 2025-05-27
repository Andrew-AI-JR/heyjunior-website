// Success page functionality
const API_BASE_URL = 'https://junior-api-915940312680.us-west1.run.app';

// Download URLs
const WINDOWS_DOWNLOAD_URL = 'https://github.com/Andrew-AI-JR/heyjunior-website/releases/download/v3.1.0-beta/LinkedIn_Automation_Tool_v3.1.0-beta.zip';
const MACOS_DOWNLOAD_URL = 'https://github.com/Andrew-AI-JR/junior/actions'; // Will be updated when DMG is available

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get('email');
const paymentIntentId = urlParams.get('payment_intent');

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
            
            // Show verified payment status
            updatePaymentStatus('verified');
        } else {
            console.warn('⚠️ Payment verification failed');
            updatePaymentStatus('unverified');
        }
    } catch (error) {
        console.error('❌ Payment verification error:', error);
        updatePaymentStatus('error');
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
    
    const downloadSection = document.querySelector('.download-section');
    if (!downloadSection) return;

    // Update download section with OS-specific content
    downloadSection.innerHTML = `
        <h2>📥 Download Your Software</h2>
        <p>Choose your operating system:</p>
        
        <div class="download-options">
            <div class="download-option ${isWindows ? 'recommended' : ''}">
                <h3>🪟 Windows</h3>
                <p>Windows 10/11 • 51 MB</p>
                <a href="${WINDOWS_DOWNLOAD_URL}" class="download-button" id="windows-download">
                    Download for Windows
                </a>
                ${isWindows ? '<span class="recommended-badge">Recommended for you</span>' : ''}
            </div>
            
            <div class="download-option ${isMac ? 'recommended' : ''}">
                <h3>🍎 macOS</h3>
                <p>macOS 10.13+ • Universal Binary</p>
                <a href="${MACOS_DOWNLOAD_URL}" class="download-button" id="macos-download">
                    Download for macOS
                </a>
                ${isMac ? '<span class="recommended-badge">Recommended for you</span>' : ''}
                <p class="note">Note: macOS version available via GitHub Actions artifacts</p>
            </div>
        </div>
        
        <div id="download-instructions" class="instructions-container">
            <!-- Download instructions will be inserted here -->
        </div>
    `;

    // Add event listeners
    document.querySelector('#windows-download').addEventListener('click', function(e) {
        trackDownload('windows');
        showWindowsInstructions();
    });

    document.querySelector('#macos-download').addEventListener('click', function(e) {
        trackDownload('macos');
        showMacOSInstructions();
    });
}

function showWindowsInstructions() {
    const instructionsDiv = document.querySelector('#download-instructions');
    if (instructionsDiv) {
        instructionsDiv.innerHTML = `
            <div class="instructions-box">
                <h3>📥 Windows Installation</h3>
                <p>Your download should begin automatically. If it doesn't:</p>
                <ol>
                    <li>Click the download button again</li>
                    <li>Or <a href="${WINDOWS_DOWNLOAD_URL}" target="_blank">click here</a></li>
                </ol>
                
                <h4>🎯 Installation Steps:</h4>
                <ol>
                    <li>Extract the ZIP file to a permanent location</li>
                    <li>Run the LinkedIn_Automation_Tool_v3.1.0-beta.exe file</li>
                    <li>Follow the setup wizard instructions</li>
                    <li>Configure your LinkedIn credentials</li>
                    <li>Start with conservative automation settings!</li>
                </ol>
                
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
                <h3>📥 macOS Installation</h3>
                <p>The macOS version is available through GitHub Actions:</p>
                <ol>
                    <li>Click the link above to go to GitHub Actions</li>
                    <li>Look for the latest "Build LinkedIn Automation Tool - macOS" workflow</li>
                    <li>Download the "linkedin-automation-macos" artifact</li>
                    <li>Unzip the downloaded file to get the DMG</li>
                </ol>
                
                <h4>🎯 Installation Steps:</h4>
                <ol>
                    <li>Double-click the DMG file to mount it</li>
                    <li>Drag the app to your Applications folder</li>
                    <li>Right-click the app and select "Open" (first time only)</li>
                    <li>Follow the setup wizard instructions</li>
                    <li>Configure your LinkedIn credentials</li>
                    <li>Start with conservative automation settings!</li>
                </ol>
                
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

// Auto-scroll to download section
setTimeout(() => {
    const downloadSection = document.querySelector('.download-section');
    if (downloadSection) {
        downloadSection.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
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

// Add CSS styles for license section
function addLicenseStyles() {
    const style = document.createElement('style');
    style.textContent = `
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
        
        .download-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 20px;
        }
        
        .download-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 12px;
            transition: all 0.3s ease;
            min-width: 200px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .download-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        
        .download-icon {
            font-size: 2em;
            margin-bottom: 8px;
        }
        
        .download-size {
            font-size: 0.85em;
            opacity: 0.8;
            margin-top: 5px;
        }
        
        @media (max-width: 768px) {
            .license-key-container {
                flex-direction: column;
            }
            
            .copy-btn {
                align-self: flex-start;
            }
            
            .download-buttons {
                flex-direction: column;
                align-items: center;
            }
        }
    `;
    document.head.appendChild(style);
} 