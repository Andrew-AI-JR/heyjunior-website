// checkout.js - Simplified for Stripe Payment Link
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
        alert('Please enter a valid email address. This email will be used for your license key and receipt.');
        return;
    }

    if (!platform) {
        e.preventDefault(); // Prevent redirect if platform is not selected
        alert('Please select your platform (Windows or macOS).');
        return;
    }

    // You can prefill email and pass platform/other data to Stripe Payment Link via URL parameters
    // Example: https://buy.stripe.com/your_link_id?prefilled_email=user@example.com&client_reference_id=platform_windows_order_123
    // Update the `paymentLink` with these parameters if your Stripe Payment Link is configured to accept them.
    // For now, we just ensure email is entered.
    // Stripe's Payment Link page will collect payment details.

    // Optional: you could store email and platform in sessionStorage to retrieve on the success page if needed
    sessionStorage.setItem('checkoutData', JSON.stringify({ email, platform }));

    // The <a> tag's default behavior will handle the redirect to the Stripe Payment Link.
    // If you dynamically construct the link, you would do: window.location.href = paymentLink;
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
            buttonTextElement.textContent = `Proceed to Payment for ${platform.charAt(0).toUpperCase() + platform.slice(1)} - $20/month`;
        } else {
            buttonTextElement.textContent = 'Proceed to Payment - $20/month';
        }
    }
} 