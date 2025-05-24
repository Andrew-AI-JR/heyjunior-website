// Stripe configuration
const stripe = Stripe('pk_test_your_publishable_key_here'); // Replace with your actual publishable key
let elements;
let emailAddress = '';

// API base URL - detect environment
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000' 
    : 'https://your-production-domain.com';

// Beta pricing
const BETA_PRICE = 2000; // $20.00 in cents

// Initialize Stripe Elements
initialize();

// Handle form submission
document.querySelector('#payment-form').addEventListener('submit', handleSubmit);

// Handle email input
document.querySelector('#customer-email').addEventListener('change', (e) => {
    emailAddress = e.target.value;
});

async function initialize() {
    try {
        // Wait for email before initializing payment
        if (!emailAddress) {
            // Try to get email from URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            emailAddress = urlParams.get('email') || '';
            if (emailAddress) {
                document.querySelector('#customer-email').value = emailAddress;
            }
        }

        const response = await fetch(`${API_BASE_URL}/create-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                items: [{ id: 'linkedin-automation-beta', amount: BETA_PRICE }],
                customer_email: emailAddress,
                subscription: true
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        const { clientSecret } = await response.json();
        
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
        
        elements = stripe.elements({ appearance, clientSecret });
        
        const paymentElementOptions = {
            layout: "tabs",
            business: {
                name: 'Junior - LinkedIn Automation Beta'
            }
        };
        
        const paymentElement = elements.create("payment", paymentElementOptions);
        paymentElement.mount("#payment-element");
        
        console.log('✅ Payment form initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing payment:', error);
        showMessage(`Error loading payment form: ${error.message}. Please refresh the page or contact support.`);
        
        // Show a fallback message
        document.querySelector("#payment-element").innerHTML = `
            <div style="padding: 20px; text-align: center; background: #fee; border-radius: 8px;">
                <h3>Payment Form Loading Error</h3>
                <p>Unable to load the payment form. Please ensure:</p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Backend server is running on port 8000</li>
                    <li>Stripe keys are properly configured</li>
                    <li>Database connection is working</li>
                </ul>
                <button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    
    if (!emailAddress || !emailAddress.includes('@')) {
        showMessage("Please enter a valid email address");
        document.querySelector('#customer-email').focus();
        return;
    }
    
    setLoading(true);
    
    // Track beta signup attempt
    trackPurchaseIntent('beta');
    
    try {
        console.log('🔄 Creating subscription...');
        
        // Create subscription for beta pricing
        const subscriptionResponse = await fetch(`${API_BASE_URL}/create-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_email: emailAddress,
                price_id: 'price_beta_20_monthly' // You'll need to create this in Stripe
            }),
        });
        
        if (!subscriptionResponse.ok) {
            const errorData = await subscriptionResponse.json().catch(() => ({ detail: 'Network error' }));
            throw new Error(errorData.detail || 'Failed to create subscription');
        }
        
        const { subscriptionId, clientSecret } = await subscriptionResponse.json();
        console.log('✅ Subscription created:', subscriptionId);
        
        // Confirm payment
        console.log('🔄 Confirming payment...');
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/success.html?beta=true&subscription=${subscriptionId}&email=${encodeURIComponent(emailAddress)}`,
                receipt_email: emailAddress,
            },
        });
        
        if (error) {
            console.error('❌ Payment error:', error);
            if (error.type === "card_error" || error.type === "validation_error") {
                showMessage(error.message);
            } else {
                showMessage("An unexpected error occurred during payment.");
            }
        }
    } catch (error) {
        console.error('❌ Payment process error:', error);
        showMessage(`Payment failed: ${error.message}. Please try again or contact support.`);
    }
    
    setLoading(false);
}

function setLoading(isLoading) {
    const submitButton = document.querySelector("#submit-button");
    const spinner = document.querySelector("#spinner");
    const buttonText = document.querySelector("#button-text");
    
    if (isLoading) {
        submitButton.disabled = true;
        spinner.classList.remove("hidden");
        buttonText.classList.add("hidden");
    } else {
        submitButton.disabled = false;
        spinner.classList.add("hidden");
        buttonText.classList.remove("hidden");
    }
}

function showMessage(messageText) {
    const messageContainer = document.querySelector("#payment-errors");
    messageContainer.textContent = messageText;
    messageContainer.style.display = 'block';
    
    // Auto-hide success messages
    if (!messageText.toLowerCase().includes('error') && !messageText.toLowerCase().includes('failed')) {
        setTimeout(function () {
            messageContainer.textContent = "";
            messageContainer.style.display = 'none';
        }, 5000);
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