// Purchase page functionality
const API_BASE_URL = 'https://junior-api-staging-915940312680.us-west1.run.app';

let stripe;
let elements;
let paymentElement;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Initializing payment system...');
    
    try {
        await initializeStripe();
        console.log('✅ Payment system ready');
    } catch (error) {
        console.error('❌ Failed to initialize payment system:', error);
        showMessage('Payment system unavailable. Please try again later.', 'error');
    }
});

async function initializeStripe() {
    // Stripe configuration
    stripe = Stripe('pk_live_51RGNsDRxE6F23RwQYPOULj2p5wnrgMIG4xgqZd5WVYEF5e4uRSDinlqT9b7hlMBCwxoUoDm4l1hO8xjKoenyK7HV00SJaVnMRj');
    let emailAddress = '';

    // Beta pricing
    const BETA_PRICE = 2000; // $20.00 in cents

    // Handle form submission
    document.querySelector('#payment-form').addEventListener('submit', handleSubmit);

    // Handle email input
    document.querySelector('#customer-email').addEventListener('change', (e) => {
        emailAddress = e.target.value;
    });

    try {
        // Show loading state
        showMessage("Setting up secure payment...");
        
        const response = await fetch(`${API_BASE_URL}/create-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: BETA_PRICE,
                currency: 'usd',
                customer_email: emailAddress || 'customer@example.com'
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

        paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");
        
        // Hide loading message
        hideMessage();
        
    } catch (error) {
        console.error('Payment initialization failed:', error);
        
        let errorMessage = "Unable to connect to payment server.";
        if (error.message.includes('Failed to fetch')) {
            errorMessage = "Backend server is not running. Please contact support.";
        } else if (error.message.includes('404')) {
            errorMessage = "Payment endpoint not found. Please contact support.";
        } else if (error.message.includes('500')) {
            errorMessage = "Server error. Please contact support.";
        }
        
        showMessage(errorMessage);
        
        // Show error notice
        document.querySelector('#payment-element').innerHTML = `
            <div class="error-payment-notice">
                <h3>⚠️ Payment System Unavailable</h3>
                <p><strong>Error:</strong> ${errorMessage}</p>
                <p>Please contact our support team at <a href="mailto:support@heyjunior.ai">support@heyjunior.ai</a></p>
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
        submitButton.innerHTML = "Start Beta Access - $20/month";
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