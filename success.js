// Success page functionality
const API_BASE_URL = 'https://junior-api-staging-915940312680.us-west1.run.app';

// GitHub release URL for v3.0.0-beta
const GITHUB_RELEASE_URL = 'https://github.com/Andrew-AI-JR/heyjunior-website/releases/download/v3.0.0-beta/LinkedIn_Automation_Tool_v3.0.0-beta.zip';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const isDemo = urlParams.get('demo') === 'true';
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
    
    // Show appropriate message based on demo mode
    if (isDemo) {
        document.querySelector('#payment-status').innerHTML = `
            <div class="demo-notice">
                <h3>🚀 Demo Mode</h3>
                <p>This is a demonstration of the download flow.</p>
                <p>In production, payment verification will be required.</p>
            </div>
        `;
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
                    <li>Run the LinkedIn_Automation_Tool_v3.0.0-beta.exe file</li>
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
            'event_label': 'v3.0.0-beta',
            'value': 1
        });
    }
    
    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Download', {
            content_name: 'LinkedIn Automation Tool Beta',
            content_type: 'product',
            content_ids: ['v3.0.0-beta']
        });
    }
}

async function handlePaymentSuccess() {
    try {
        // Show loading state
        document.getElementById('status-message').textContent = 'Finalizing your subscription...';
        
        // Verify payment with backend
        const response = await fetch(`${API_BASE_URL}/verify-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                payment_intent_id: paymentIntentId,
                email: email
            })
        });

        if (!response.ok) {
            throw new Error('Payment verification failed');
        }

        const data = await response.json();
        
        // Show success message
        document.getElementById('status-message').textContent = 'Payment successful! Preparing your download...';
        document.getElementById('download-section').style.display = 'block';
        
        // Set download link
        const downloadButton = document.getElementById('download-button');
        downloadButton.href = data.download_url;
        
        // Show setup instructions
        document.getElementById('setup-instructions').style.display = 'block';
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('status-message').textContent = 'There was an error processing your payment. Please contact support.';
    }
}

// Initialize page
window.addEventListener('load', () => {
    if (email && paymentIntentId) {
        handlePaymentSuccess();
    } else {
        document.getElementById('status-message').textContent = 'Invalid payment session. Please try again or contact support.';
    }
});

function showCustomerInfo(email, amount) {
    const customerInfo = document.createElement('div');
    customerInfo.className = 'customer-info';
    customerInfo.innerHTML = `
        <div class="customer-details">
            <h3>Order Details</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Amount:</strong> $${(amount / 100).toFixed(2)}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
    `;
    
    const successHeader = document.querySelector('.success-header');
    successHeader.appendChild(customerInfo);
}

function showLoading() {
    const downloadSection = document.querySelector('.download-section');
    downloadSection.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <h3>Verifying your payment...</h3>
            <p>Please wait while we confirm your purchase.</p>
        </div>
    `;
}

function hideLoading() {
    // The download section content is already set in the HTML
    // This function can be used to show/hide loading states if needed
}

function showErrorMessage() {
    const downloadSection = document.querySelector('.download-section');
    downloadSection.innerHTML = `
        <div class="error-state">
            <div class="error-icon">❌</div>
            <h3>Payment Verification Failed</h3>
            <p>We couldn't verify your payment. Please contact support with your order details.</p>
            <div class="error-actions">
                <a href="mailto:support@heyjunior.ai?subject=Payment%20Verification%20Issue" class="primary-button">
                    Contact Support
                </a>
                <a href="purchase.html" class="secondary-button">
                    Try Again
                </a>
            </div>
        </div>
    `;
}

function trackSuccessfulPurchase(isSubscription) {
    // Google Analytics tracking
    if (typeof gtag !== 'undefined') {
        gtag('event', 'purchase', {
            transaction_id: Date.now().toString(),
            value: isSubscription ? 29 : 97,
            currency: 'USD',
            items: [{
                item_id: 'linkedin-automation-tool',
                item_name: 'LinkedIn Automation Tool',
                category: 'Software',
                quantity: 1,
                price: isSubscription ? 29 : 97
            }]
        });
    }
    
    // Facebook Pixel tracking
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Purchase', {
            value: isSubscription ? 29 : 97,
            currency: 'USD',
            content_name: 'LinkedIn Automation Tool',
            content_category: 'Software'
        });
    }
    
    console.log('Purchase tracked:', isSubscription ? 'subscription' : 'one-time');
}

function trackDownloadStart() {
    // Track download initiation
    if (typeof gtag !== 'undefined') {
        gtag('event', 'download', {
            event_category: 'Software',
            event_label: 'LinkedIn Automation Tool v2.1.1'
        });
    }
    
    console.log('Download started');
}

// Auto-scroll to download section
setTimeout(() => {
    document.querySelector('.download-section').scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}, 1000); 