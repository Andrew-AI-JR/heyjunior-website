// Purchase page functionality
const API_BASE_URL = 'https://junior-api-915940312680.us-west1.run.app';

let stripe;
let elements;
let paymentElement;
let isPaymentInitialized = false;

// Add license management integration
const LICENSE_API_BASE = 'https://junior-api-915940312680.us-west1.run.app/api/license';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Setting up beta selection...');
    
    // Set up beta selection flow
    setupBetaSelection();
    
    console.log('✅ Beta selection ready');
});

function setupBetaSelection() {
    const selectBetaButton = document.querySelector('#select-beta-button');
    const paymentSection = document.querySelector('#payment-section');
    const betaCTASection = document.querySelector('.beta-cta-section');
    const backButton = document.querySelector('#back-button');

    // Handle beta selection
    selectBetaButton.addEventListener('click', async function() {
        console.log('🚀 User selected beta access');
        
        // Hide beta selection and show payment form
        betaCTASection.style.display = 'none';
        paymentSection.classList.remove('hidden');
        
        // Initialize Stripe if not already done
        if (!isPaymentInitialized) {
            showMessage("Setting up secure payment...");
            try {
                await initializeStripe();
                hideMessage();
                console.log('✅ Payment system ready');
            } catch (error) {
                console.error('❌ Failed to initialize payment system:', error);
                showMessage('Payment system unavailable. Please try again later.');
            }
        }
        
        // Scroll to payment form
        paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Handle back button
    backButton.addEventListener('click', function() {
        console.log('👈 User returned to beta selection');
        
        // Show beta selection and hide payment form
        paymentSection.classList.add('hidden');
        betaCTASection.style.display = 'block';
        
        // Clear any messages
        hideMessage();
        
        // Scroll back to beta selection
        betaCTASection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

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
        // Use the proper backend endpoint for payment intent creation
        const response = await fetch(`${API_BASE_URL}/payments/create-payment-intent`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                amount: BETA_PRICE,
                currency: 'usd',
                customer_email: emailAddress || 'customer@example.com',
                metadata: {
                    product: 'linkedin-automation-beta',
                    version: 'v3.1.0-beta'
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Backend server returned ${response.status}: ${errorData.detail || response.statusText}`);
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
        
        isPaymentInitialized = true;
        
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
        
        // Show error notice with alternative payment options
        document.querySelector('#payment-element').innerHTML = `
            <div class="error-payment-notice">
                <h3>⚠️ Payment System Temporarily Unavailable</h3>
                <p><strong>We're experiencing technical difficulties with our automated payment system.</strong></p>
                
                <div class="alternative-payment-options">
                    <h4>🚀 Get Beta Access Now - Alternative Options:</h4>
                    
                    <div class="payment-option">
                        <h5>📧 Email Payment Request</h5>
                        <p>Send us an email and we'll send you a direct payment link:</p>
                        <a href="mailto:amalinow1973@gmail.com?subject=LinkedIn Automation Beta Access Request&body=Hi! I'd like to purchase beta access to the LinkedIn Automation Tool for $20/month. Please send me a payment link. Thanks!" 
                           class="contact-button email-button">
                            📧 Request Payment Link via Email
                        </a>
                    </div>
                    
                    <div class="payment-option">
                        <h5>💳 Direct Stripe Payment</h5>
                        <p>Use our backup Stripe payment link:</p>
                        <a href="https://buy.stripe.com/aFabJ3alfcbOcfB8GE3cc01" 
                           target="_blank" 
                           class="contact-button stripe-button">
                            💳 Pay with Stripe (Opens New Tab)
                        </a>
                        <small>Note: You'll receive download instructions via email after payment</small>
                    </div>
                    
                    <div class="payment-option">
                        <h5>💬 Live Support</h5>
                        <p>Contact us directly for immediate assistance:</p>
                        <a href="mailto:amalinow1973@gmail.com?subject=LinkedIn Automation Beta - Payment Issue&body=Hi! I'm trying to purchase the LinkedIn Automation Tool beta but the payment system isn't working. Can you help me complete my purchase? Thanks!" 
                           class="contact-button support-button">
                            💬 Contact Support
                        </a>
                    </div>
                </div>
                
                <div class="error-details">
                    <p><strong>Technical Details:</strong> ${errorMessage}</p>
                    <p><small>Error occurred at: ${new Date().toLocaleString()}</small></p>
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

    try {
        const {error, paymentIntent} = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/success.html?email=${encodeURIComponent(email)}`,
                receipt_email: email,
            },
            redirect: 'if_required'
        });

        if (error) {
            if (error.type === "card_error" || error.type === "validation_error") {
                showMessage(error.message);
            } else {
                showMessage("An unexpected error occurred.");
            }
            setLoading(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            // Payment succeeded, verify with backend and create customer
            await verifyPaymentAndCreateCustomer(paymentIntent.id, email);
        }
    } catch (error) {
        console.error('Payment error:', error);
        showMessage("Payment processing failed. Please try again.");
        setLoading(false);
    }
}

async function verifyPaymentAndCreateCustomer(paymentIntentId, email) {
    try {
        showMessage('Verifying payment and setting up your account...');
        
        // Verify payment with backend
        const verifyResponse = await fetch(`${API_BASE_URL}/payments/verify-payment`, {
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

        if (!verifyResponse.ok) {
            throw new Error('Payment verification failed');
        }

        const verifyData = await verifyResponse.json();
        
        // Create customer record
        const customerResponse = await fetch(`${API_BASE_URL}/payments/customers`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                payment_intent_id: paymentIntentId,
                subscription_status: 'active',
                plan: 'beta',
                metadata: {
                    signup_date: new Date().toISOString(),
                    version: 'v3.1.0-beta'
                }
            })
        });

        if (!customerResponse.ok) {
            console.warn('Customer creation failed, but payment succeeded');
        }

        // Track successful purchase
        trackPurchaseComplete(email, paymentIntentId);
        
        // Redirect to success page
        window.location.href = `success.html?email=${encodeURIComponent(email)}&payment_intent=${paymentIntentId}`;
        
    } catch (error) {
        console.error('Post-payment processing failed:', error);
        showMessage('Payment succeeded, but account setup failed. Please contact support with your payment confirmation.');
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
        submitButton.innerHTML = "Complete Beta Signup - $20/month";
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

// Track completed purchase
function trackPurchaseComplete(email, paymentIntentId) {
    console.log(`🎉 Purchase completed: ${email}`);
    
    // Google Analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', 'purchase', {
            transaction_id: paymentIntentId,
            value: 20,
            currency: 'USD',
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
        fbq('track', 'Purchase', {
            value: 20,
            currency: 'USD',
            content_name: 'LinkedIn Automation Tool Beta',
            content_type: 'product',
            content_ids: ['linkedin-automation-beta']
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

// Function to process payment and generate license
async function processPaymentAndGenerateLicense(paymentIntentId, customerEmail, amount) {
    try {
        const response = await fetch(`${LICENSE_API_BASE}/process-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customer_email: customerEmail,
                stripe_payment_intent_id: paymentIntentId,
                amount: amount,
                plan: amount >= 9900 ? 'lifetime' : 'beta',
                duration_days: amount >= 9900 ? 3650 : 30
            })
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            return {
                success: true,
                license_key: result.license_key,
                license_id: result.license_id
            };
        } else {
            throw new Error(result.error || 'Failed to generate license');
        }
    } catch (error) {
        console.error('License generation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Function to send license via email
async function sendLicenseEmail(customerEmail, licenseKey, licenseId) {
    try {
        // You can integrate with your email service here
        // For now, we'll store it locally and show it to the user
        
        const licenseData = {
            email: customerEmail,
            license_key: licenseKey,
            license_id: licenseId,
            generated_at: new Date().toISOString()
        };
        
        // Store in localStorage for user to access
        localStorage.setItem('user_license', JSON.stringify(licenseData));
        
        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
}

// Update the existing payment success handler
async function handlePaymentSuccess(paymentIntent) {
    try {
        // Get customer email from the form or payment metadata
        const customerEmail = document.getElementById('email')?.value || 
                             paymentIntent.metadata?.customer_email;
        
        if (!customerEmail) {
            throw new Error('Customer email not found');
        }
        
        // Generate license
        const licenseResult = await processPaymentAndGenerateLicense(
            paymentIntent.id,
            customerEmail,
            paymentIntent.amount
        );
        
        if (licenseResult.success) {
            // Send license via email
            await sendLicenseEmail(customerEmail, licenseResult.license_key, licenseResult.license_id);
            
            // Redirect to success page with license info
            const successUrl = new URL('success.html', window.location.origin);
            successUrl.searchParams.set('license_id', licenseResult.license_id);
            successUrl.searchParams.set('email', customerEmail);
            
            window.location.href = successUrl.toString();
        } else {
            throw new Error(licenseResult.error);
        }
        
    } catch (error) {
        console.error('Payment success handling error:', error);
        showError('Payment successful, but there was an issue generating your license. Please contact support.');
    }
} 