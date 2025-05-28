// checkout.js - Enhanced for Account Creation Integration
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners
    document.getElementById('stripe-payment-link-button')?.addEventListener('click', handleProceedToPayment);
    
    // Platform selection listeners
    document.querySelectorAll('input[name="platform"]').forEach(radio => {
        radio.addEventListener('change', updateButtonText);
    });

    // Initialize button text
    updateButtonText();
});

function handleProceedToPayment(e) {
    const email = document.getElementById('customer-email').value;
    const platform = document.querySelector('input[name="platform"]:checked')?.value;
    const stripeLinkButton = document.getElementById('stripe-payment-link-button');
    let paymentLink = stripeLinkButton.href; // Get the base link

    if (!email || !validateEmail(email)) {
        e.preventDefault(); // Prevent redirect if email is invalid
        alert('Please enter a valid email address. This email will be used for your account creation and license key.');
        return;
    }

    if (!platform) {
        e.preventDefault(); // Prevent redirect if platform is not selected
        alert('Please select your platform (Windows or macOS).');
        return;
    }

    // Store checkout data for account creation after payment
    const checkoutData = {
        email: email,
        platform: platform,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer || 'direct'
    };

    // Store in sessionStorage for success page
    sessionStorage.setItem('checkoutData', JSON.stringify(checkoutData));

    // Also store in localStorage as backup (in case session is lost during redirect)
    localStorage.setItem('pendingAccountCreation', JSON.stringify(checkoutData));

    // Update the Stripe Payment Link to include customer email in metadata
    // This ensures the webhook can identify the customer for account creation
    try {
        const url = new URL(paymentLink);
        url.searchParams.set('prefilled_email', email);
        url.searchParams.set('client_reference_id', `platform_${platform}_${Date.now()}`);
        stripeLinkButton.href = url.toString();
    } catch (error) {
        console.warn('Could not modify payment link URL:', error);
        // Continue with original link if URL modification fails
    }

    // Show loading state
    const buttonText = document.getElementById('button-text');
    if (buttonText) {
        buttonText.textContent = 'Redirecting to secure payment...';
        stripeLinkButton.style.opacity = '0.7';
        stripeLinkButton.style.pointerEvents = 'none';
    }

    // The <a> tag's default behavior will handle the redirect to the Stripe Payment Link
    // After successful payment, Stripe will redirect to success.html with payment details
    // The webhook will handle account creation automatically
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function updateButtonText() {
    const platform = document.querySelector('input[name="platform"]:checked')?.value;
    const buttonTextElement = document.getElementById('button-text');
    if (buttonTextElement) {
        if (platform) {
            const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
            buttonTextElement.textContent = `Proceed to Payment for ${platformName} - $20/month`;
        } else {
            buttonTextElement.textContent = 'Proceed to Payment - $20/month';
        }
    }
}

// Clean up any pending account creation data when leaving the page
window.addEventListener('beforeunload', () => {
    // Only clean up if we're not going to Stripe (payment link)
    const stripeLinkButton = document.getElementById('stripe-payment-link-button');
    if (stripeLinkButton && !stripeLinkButton.href.includes('stripe.com')) {
        localStorage.removeItem('pendingAccountCreation');
    }
}); 