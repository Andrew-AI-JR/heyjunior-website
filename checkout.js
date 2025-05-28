// Stripe configuration
const stripe = Stripe('pk_test_51OJlvNDPpSthVQMcVcz8Zzp7ssYbKKDJVIJQH9g2pMwFVhqKmLVBRoURt1hXfOKoqBpHisFPOCxHkVpbLhc5Axzs00kiAYxQxe');

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Stripe Elements
    await initializePayment();
    
    // Add event listeners
    document.getElementById('submit-payment').addEventListener('click', handleSubmit);
    
    // Platform selection listeners
    document.querySelectorAll('input[name="platform"]').forEach(radio => {
        radio.addEventListener('change', updateButtonText);
    });
});

let elements;
let paymentElement;

async function initializePayment() {
    try {
        // Create payment intent
        const response = await fetch('https://junior-api-915940312680.us-west1.run.app/api/v1/payments/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: 2000, // $20.00 in cents
                currency: 'usd',
                description: 'LinkedIn Automation Tool - Beta Access'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create payment intent');
        }

        const { clientSecret } = await response.json();

        // Create Stripe Elements
        const appearance = {
            theme: 'stripe',
            variables: {
                colorPrimary: '#2563eb',
                colorBackground: '#ffffff',
                colorSurface: '#ffffff',
                colorText: '#1a202c',
                colorDanger: '#dc3545',
                fontFamily: 'Roboto, sans-serif',
                spacingUnit: '4px',
                borderRadius: '6px',
            }
        };

        elements = stripe.elements({ appearance, clientSecret });

        // Create and mount payment element
        paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');

    } catch (error) {
        console.error('Error initializing payment:', error);
        showError('Failed to initialize payment. Please refresh the page and try again.');
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    // Disable submit button
    const submitButton = document.getElementById('submit-payment');
    submitButton.disabled = true;
    document.getElementById('spinner').classList.remove('hidden');
    document.getElementById('button-text').classList.add('hidden');

    // Get form data
    const email = document.getElementById('customer-email').value;
    const platform = document.querySelector('input[name="platform"]:checked').value;

    // Validate email
    if (!email || !validateEmail(email)) {
        showError('Please enter a valid email address');
        resetButton();
        return;
    }

    try {
        // Confirm payment with Stripe
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                receipt_email: email,
            },
            redirect: 'if_required'
        });

        if (error) {
            showError(error.message);
            resetButton();
            return;
        }

        if (paymentIntent.status === 'succeeded') {
            // Payment successful - process the order
            await processSuccessfulPayment(paymentIntent.id, email, platform);
        }

    } catch (error) {
        console.error('Payment error:', error);
        showError('Payment failed. Please try again.');
        resetButton();
    }
}

async function processSuccessfulPayment(paymentIntentId, email, platform) {
    try {
        // Call backend to generate license and process order
        const response = await fetch('https://junior-api-915940312680.us-west1.run.app/api/v1/payments/process-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                payment_intent_id: paymentIntentId,
                email: email,
                platform: platform,
                product: 'linkedin-automation-beta',
                amount: 2000
            })
        });

        if (!response.ok) {
            throw new Error('Failed to process order');
        }

        const orderData = await response.json();

        // Store order data for success page
        sessionStorage.setItem('orderData', JSON.stringify({
            email: email,
            platform: platform,
            license_key: orderData.license_key,
            order_id: orderData.order_id,
            payment_intent_id: paymentIntentId
        }));

        // Redirect to success page
        window.location.href = 'success.html';

    } catch (error) {
        console.error('Order processing error:', error);
        // Payment succeeded but order processing failed
        // Still redirect to success page with limited info
        sessionStorage.setItem('orderData', JSON.stringify({
            email: email,
            platform: platform,
            payment_intent_id: paymentIntentId,
            error: 'Order processing delayed. You will receive your license key via email shortly.'
        }));
        window.location.href = 'success.html';
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showError(message) {
    const errorDiv = document.getElementById('payment-errors');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function resetButton() {
    const submitButton = document.getElementById('submit-payment');
    submitButton.disabled = false;
    document.getElementById('spinner').classList.add('hidden');
    document.getElementById('button-text').classList.remove('hidden');
}

function updateButtonText() {
    const platform = document.querySelector('input[name="platform"]:checked').value;
    const buttonText = document.getElementById('button-text');
    buttonText.textContent = `Complete Purchase - $20/month`;
}

// Add loading state to payment element
if (paymentElement) {
    paymentElement.on('ready', () => {
        // Payment element is ready
        console.log('Payment element ready');
    });

    paymentElement.on('change', (event) => {
        // Handle real-time validation errors from the payment element
        if (event.error) {
            showError(event.error.message);
        } else {
            // Clear error
            document.getElementById('payment-errors').style.display = 'none';
        }
    });
} 