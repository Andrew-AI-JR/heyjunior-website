// Success page functionality
const API_BASE_URL = 'https://junior-api-staging-915940312680.us-west1.run.app';

// GitHub release URL for v3.0.2-beta
const GITHUB_RELEASE_URL = 'https://github.com/Andrew-AI-JR/heyjunior-website/releases/download/v3.0.2-beta/LinkedIn_Automation_Tool_v3.0.2-beta.zip';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const email = urlParams.get('email');
const paymentIntentId = urlParams.get('payment_intent');

document.addEventListener('DOMContentLoaded', function() {
    // Update success message
    document.querySelector('#customer-email').textContent = email || 'your email';
    
    // Set download link
    const downloadButton = document.querySelector('#download-button');
    if (downloadButton) {
        downloadButton.href = GITHUB_RELEASE_URL;
        downloadButton.addEventListener('click', function(e) {
            // Track download
            console.log('🔄 Download started');
            trackDownload();
            
            // Show additional instructions
            showDownloadInstructions();
        });
    }
});

function showDownloadInstructions() {
    const instructionsDiv = document.querySelector('#download-instructions');
    if (instructionsDiv) {
        instructionsDiv.innerHTML = `
            <div class="instructions-box">
                <h3>📥 Download Starting...</h3>
                <p>Your download should begin automatically. If it doesn't:</p>
                <ol>
                    <li>Click the download button again</li>
                    <li>Or <a href="${GITHUB_RELEASE_URL}" target="_blank">click here</a></li>
                </ol>
                
                <h4>🎯 Next Steps:</h4>
                <ol>
                    <li>Extract the ZIP file to a permanent location</li>
                    <li>Run the LinkedIn_Automation_Tool_v3.0.2-beta.exe file</li>
                    <li>Follow the setup wizard instructions</li>
                    <li>Start with conservative automation settings!</li>
                </ol>
                
                <p><strong>Need help?</strong> Check the installation guide included in the download.</p>
            </div>
        `;
    }
}

function trackDownload() {
    // Google Analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', 'download', {
            'event_category': 'Beta Release',
            'event_label': 'v3.0.1-beta',
            'value': 1
        });
    }
    
    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Download', {
            content_name: 'LinkedIn Automation Tool Beta',
            content_type: 'product',
            content_ids: ['v3.0.1-beta']
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