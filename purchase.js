// Stripe configuration
const stripe = Stripe('pk_live_51RGNsDRxE6F23RwQYPOULj2p5wnrgMIG4xgqZd5WVYEF5e4uRSDinlqT9b7hlMBCwxoUoDm4l1hO8xjKoenyK7HV00SJaVnMRj'); // Replace with your actual publishable key
let elements;
let emailAddress = '';

// API base URL - detect environment
const isGitHubPages = window.location.hostname.includes('github.io');
const API_BASE_URL = isGitHubPages 
    ? 'https://junior-api-staging-915940312680.us-west1.run.app' // GCP environment
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
        ? 'http://localhost:8000' 
        : 'https://junior-api-staging-915940312680.us-west1.run.app'; // Default to GCP

// Beta pricing
const BETA_PRICE = 2000; // $20.00 in cents

// GitHub Pages demo mode
const DEMO_MODE = false; // Disable demo mode since we have a live backend

if (DEMO_MODE) {
    console.log('🚀 Demo Mode: Using simulated payments');
    // Show demo mode notice immediately
    document.querySelector('#payment-element').innerHTML = `
        <div class="demo-payment-notice">
            <h3>🚀 Demo Mode Active</h3>
            <p>This is a demonstration of the payment flow.</p>
            <p>Enter your email above and click the button to simulate a payment.</p>
            <div class="demo-test-cards">
                <h4>Test Card Numbers:</h4>
                <ul>
                    <li>Success: 4242 4242 4242 4242</li>
                    <li>Decline: 4000 0000 0000 0002</li>
                </ul>
            </div>
        </div>
    `;
    
    // Update button text for demo
    const submitButton = document.querySelector("#submit-button");
    submitButton.innerHTML = "Try Demo Payment - $20/month";
}

// Handle form submission
document.querySelector('#payment-form').addEventListener('submit', handleSubmit);

// Handle email input
document.querySelector('#customer-email').addEventListener('change', (e) => {
    emailAddress = e.target.value;
});

async function initialize() {
    try {
        // Show loading state
        showMessage("Setting up secure payment...");
        
        const response = await fetch(`${API_BASE_URL}/create-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: BETA_PRICE,
                currency: 'usd',
                customer_email: emailAddress || 'demo@example.com'
            })
        });

        if (!response.ok) {
            throw new Error(`Backend server returned ${response.status}: ${response.statusText}`);
        }

        const { client_secret, publishable_key } = await response.json();
        
        // Update Stripe key if provided by backend
        if (publishable_key) {
            stripe = Stripe(publishable_key);
        }

        const appearance = {
            theme: 'stripe',
            variables: {
                colorPrimary: '#ff6b6b',
                colorBackground: '#ffffff',
                colorText: '#30313d',
                colorDanger: '#df1b41',
                fontFamily: 'Roboto, system-ui, sans-serif',
                spacingUnit: '4px',
                borderRadius: '8px',
            }
        };
        elements = stripe.elements({ appearance, clientSecret: client_secret });

        const paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");
        
        // Hide loading message
        hideMessage();
        
    } catch (error) {
        console.error('Payment initialization failed:', error);
        
        let errorMessage = "Unable to connect to payment server.";
        if (error.message.includes('Failed to fetch')) {
            errorMessage = "Backend server is not running. Please start the server first.";
        } else if (error.message.includes('404')) {
            errorMessage = "Payment endpoint not found. Please check your backend configuration.";
        } else if (error.message.includes('500')) {
            errorMessage = "Server error. Please check your backend logs.";
        }
        
        showMessage(errorMessage);
        
        // Fallback: Show manual payment instructions
        document.querySelector('#payment-element').innerHTML = `
            <div class="error-payment-notice">
                <h3>⚠️ Payment Server Unavailable</h3>
                <p><strong>Error:</strong> ${errorMessage}</p>
                <div class="troubleshooting">
                    <h4>To fix this issue:</h4>
                    <ol>
                        <li><strong>For local development:</strong> Start the backend server by running:<br>
                            <code>python start_dev.py</code></li>
                        <li><strong>For production:</strong> Ensure your backend is deployed and the API_BASE_URL is correct</li>
                        <li><strong>For demo:</strong> <button type="button" onclick="simulatePayment()" class="demo-payment-button">Try Demo Mode</button></li>
                    </ol>
                </div>
            </div>
        `;
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    
    // Validate email
    const email = document.querySelector('#customer-email').value;
    if (!email || !email.includes('@')) {
        showMessage('Please enter a valid email address.');
        return;
    }

    setLoading(true);
    showMessage('Processing payment...');

    if (DEMO_MODE) {
        simulatePayment();
    } else {
        try {
            const {error} = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/success.html?email=${encodeURIComponent(email)}`,
                    receipt_email: email,
                },
            });

            if (error) {
                if (error.type === "card_error" || error.type === "validation_error") {
                    showMessage(error.message);
                } else {
                    showMessage("An unexpected error occurred.");
                }
                setLoading(false);
            }
        } catch (error) {
            console.error('Payment error:', error);
            showMessage("Payment processing failed. Please try again.");
            setLoading(false);
        }
    }
}

// Demo mode functions
function simulatePayment() {
    const email = document.querySelector('#customer-email').value;
    if (!email || !email.includes('@')) {
        showMessage('Please enter a valid email address for the demo.');
        setLoading(false);
        return;
    }
    
    showMessage('🚀 Processing demo payment...');
    
    // Simulate payment delay
    setTimeout(() => {
        showMessage('✅ Demo payment successful! Redirecting...');
        setTimeout(() => {
            // Redirect to success page with demo parameters
            const successUrl = `success.html?demo=true&email=${encodeURIComponent(email)}&amount=20&currency=USD`;
            window.location.href = successUrl;
        }, 1000);
    }, 2000);
}

// Helper functions
function showMessage(messageText) {
    const messageContainer = document.querySelector("#payment-message");
    messageContainer.classList.remove("hidden");
    messageContainer.textContent = messageText;
}

function hideMessage() {
    const messageContainer = document.querySelector("#payment-message");
    messageContainer.classList.add("hidden");
}

// Show a spinner on payment submission
function setLoading(isLoading) {
    const submitButton = document.querySelector("#submit-button");
    
    if (isLoading) {
        // Disable the button and show a spinner
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <div class="spinner" id="spinner"></div>
            <span id="button-text">Processing...</span>
        `;
    } else {
        submitButton.disabled = false;
        if (DEMO_MODE) {
            submitButton.innerHTML = "Try Demo Payment";
        } else {
            submitButton.innerHTML = "Subscribe Now - $20/month";
        }
    }
}

// Add analytics tracking for beta signups
function trackPurchaseIntent(planType) {
    console.log(`🎯 Beta signup intent: ${planType}`);
    
    // Google Analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', 'begin_checkout', {
            currency: 'USD',
            value: 20,
            items: [{
                item_id: 'linkedin-automation-beta',
                item_name: 'LinkedIn Automation Tool Beta',
                category: 'Software',
                quantity: 1,
                price: 20
            }]
        });
    }
    
    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('track', 'InitiateCheckout', {
            value: 20,
            currency: 'USD',
            content_name: 'LinkedIn Automation Tool Beta',
            content_category: 'Software'
        });
    }
}

// Beta-specific messaging
function showBetaWelcome() {
    console.log('🎉 Welcome to the LinkedIn Automation Tool Beta!');
    console.log('💡 Backend API:', API_BASE_URL);
}

// Initialize beta welcome
showBetaWelcome(); 