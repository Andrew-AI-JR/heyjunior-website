// Success page functionality
const API_BASE_URL = 'https://junior-api-915940312680.us-west1.run.app';

// Download URLs
const WINDOWS_DOWNLOAD_URL = 'https://github.com/Andrew-AI-JR/heyjunior-website/releases/download/v3.0.2-beta/LinkedIn_Automation_Tool_v3.0.2-beta.zip';
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
                <p>Windows 10/11 • 26 MB</p>
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
                    <li>Run the LinkedIn_Automation_Tool_v3.0.2-beta.exe file</li>
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
            'event_label': `v3.0.2-beta-${platform}`,
            'value': 1
        });
    }
    
    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Download', {
            content_name: `LinkedIn Automation Tool Beta - ${platform}`,
            content_type: 'product',
            content_ids: [`v3.0.2-beta-${platform}`]
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