// Success page functionality
const API_BASE_URL = 'https://your-api-domain.com'; // Replace with your actual API URL

document.addEventListener('DOMContentLoaded', function() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const paymentIntent = urlParams.get('payment_intent');
    const subscription = urlParams.get('subscription');
    
    if (sessionId || paymentIntent) {
        // Verify payment and get download link
        verifyPaymentAndGenerateDownloadLink(sessionId, paymentIntent, subscription);
    } else {
        // Redirect to purchase page if no valid payment
        window.location.href = 'purchase.html';
    }
    
    // Track successful purchase
    trackSuccessfulPurchase(subscription);
});

async function verifyPaymentAndGenerateDownloadLink(sessionId, paymentIntent, isSubscription) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/verify-payment-and-generate-download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: sessionId,
                payment_intent: paymentIntent,
                subscription: isSubscription === 'true'
            })
        });
        
        if (!response.ok) {
            throw new Error('Payment verification failed');
        }
        
        const data = await response.json();
        
        if (data.verified && data.download_url) {
            // Set up the download link
            const downloadLink = document.getElementById('download-link');
            downloadLink.href = data.download_url;
            downloadLink.addEventListener('click', handleDownloadClick);
            
            // Show customer info if available
            if (data.customer_email) {
                showCustomerInfo(data.customer_email, data.amount);
            }
            
            hideLoading();
        } else {
            throw new Error('Invalid payment verification');
        }
        
    } catch (error) {
        console.error('Error verifying payment:', error);
        showErrorMessage();
    }
}

function handleDownloadClick(e) {
    // Track download initiation
    trackDownloadStart();
    
    // Show download instructions
    showDownloadInstructions();
    
    // Optional: Disable the link after first download
    setTimeout(() => {
        const downloadLink = e.target;
        downloadLink.style.opacity = '0.6';
        downloadLink.innerHTML = `
            <span class="download-icon">✅</span>
            Download Started
            <small>Check your Downloads folder</small>
        `;
    }, 1000);
}

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

function showDownloadInstructions() {
    const instructions = document.createElement('div');
    instructions.className = 'download-instructions-popup';
    instructions.innerHTML = `
        <div class="popup-content">
            <h3>Download Started!</h3>
            <p>Your LinkedIn Automation Tool is downloading...</p>
            <div class="instructions">
                <h4>Next Steps:</h4>
                <ol>
                    <li>Check your Downloads folder</li>
                    <li>Right-click the file and "Run as administrator"</li>
                    <li>Follow the installation wizard</li>
                    <li>Launch the app and enter your LinkedIn credentials</li>
                </ol>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="close-popup">Got it!</button>
        </div>
    `;
    
    document.body.appendChild(instructions);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (instructions.parentNode) {
            instructions.remove();
        }
    }, 10000);
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