/* Updated: Coupon case sensitivity fix - Version 1.1 */
// checkout.js - Enhanced for Account Creation Integration with Coupon Support
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners
    document.getElementById('stripe-payment-link-button')?.addEventListener('click', handleProceedToPayment);
    document.getElementById('apply-coupon-btn')?.addEventListener('click', handleApplyCoupon);
    
    // Platform selection listeners
    document.querySelectorAll('input[name="platform"]').forEach(radio => {
        radio.addEventListener('change', updateButtonText);
    });

    // Coupon code input listener
    document.getElementById('coupon-code')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleApplyCoupon();
        }
    });

    // Initialize button text
    updateButtonText();
});

// Global variables for coupon state
let appliedCoupon = null;
let originalPrice = 20; // Base price in dollars
let discountedPrice = 20;

async function handleApplyCoupon() {
    const couponInput = document.getElementById('coupon-code');
    const applyBtn = document.getElementById('apply-coupon-btn');
    const messageDiv = document.getElementById('coupon-message');
    const discountDiv = document.getElementById('coupon-discount');
    
    const couponCode = couponInput.value.trim();
    
    if (!couponCode) {
        showCouponMessage('Please enter a coupon code', 'error');
        return;
    }
    
    // Show loading state
    applyBtn.disabled = true;
    applyBtn.classList.add('loading');
    applyBtn.textContent = 'Checking...';
    
    try {
        // Check for special frontend-only coupons first (case-insensitive)
        const lowerCouponCode = couponCode.toLowerCase();
        if (lowerCouponCode === 'tacos') {
            // Apply 100% discount for Tacos coupon
            const tacosCarbon = {
                id: 'tacos_100_off',
                name: 'Tacos Special',
                percent_off: 100,
                valid: true
            };
            
            appliedCoupon = tacosCarbon;
            updatePricingDisplay(tacosCarbon);
            showCouponDiscount(tacosCarbon);
            showCouponMessage(`Coupon "${couponCode}" applied successfully! 100% off for 1 month!`, 'success');
            
            // Disable the input and button
            couponInput.disabled = true;
            applyBtn.style.display = 'none';
            return;
        }
        
        // Try backend validation for other coupons
        const response = await fetch('https://junior-api-915940312680.us-west1.run.app/api/payments/validate-coupon', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                coupon_code: couponCode
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.valid) {
            // Apply the coupon
            appliedCoupon = result.coupon;
            updatePricingDisplay(result.coupon);
            showCouponDiscount(result.coupon);
            showCouponMessage(`Coupon "${couponCode}" applied successfully!`, 'success');
            
            // Disable the input and button
            couponInput.disabled = true;
            applyBtn.style.display = 'none';
            
        } else {
            showCouponMessage(result.message || 'Invalid coupon code', 'error');
        }
        
    } catch (error) {
        console.error('Error validating coupon:', error);
        // If backend is down, check for other frontend-only coupons or show error
        showCouponMessage('Invalid coupon code', 'error');
    } finally {
        // Reset button state
        applyBtn.disabled = false;
        applyBtn.classList.remove('loading');
        applyBtn.textContent = 'Apply';
    }
}

function showCouponMessage(message, type) {
    const messageDiv = document.getElementById('coupon-message');
    messageDiv.textContent = message;
    messageDiv.className = `coupon-message ${type}`;
}

function showCouponDiscount(coupon) {
    const discountDiv = document.getElementById('coupon-discount');
    const discountAmountSpan = document.getElementById('discount-amount');
    
    let discountText = '';
    if (coupon.percent_off) {
        discountText = `${coupon.percent_off}% off`;
    } else if (coupon.amount_off) {
        discountText = `$${(coupon.amount_off / 100).toFixed(2)} off`;
    }
    
    discountAmountSpan.textContent = discountText;
    
    // Add remove button
    if (!discountDiv.querySelector('.remove-coupon')) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-coupon';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove coupon';
        removeBtn.addEventListener('click', removeCoupon);
        discountDiv.appendChild(removeBtn);
    }
    
    discountDiv.style.display = 'flex';
    
    // Update payment section for free accounts
    if (coupon.percent_off === 100 || discountedPrice === 0) {
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            const heading = paymentSection.querySelector('h3');
            const description = paymentSection.querySelector('p');
            
            if (heading) {
                heading.textContent = '🎉 Start Your Free Trial';
                heading.style.color = '#10b981';
            }
            
            if (description) {
                description.textContent = 'Click below to start your free 1-month trial and download Junior immediately!';
                description.style.color = '#059669';
                description.style.fontWeight = '500';
            }
        }
    }
}

function removeCoupon() {
    appliedCoupon = null;
    discountedPrice = originalPrice;
    
    // Reset UI
    document.getElementById('coupon-code').value = '';
    document.getElementById('coupon-code').disabled = false;
    document.getElementById('apply-coupon-btn').style.display = 'inline-block';
    document.getElementById('coupon-message').className = 'coupon-message';
    document.getElementById('coupon-discount').style.display = 'none';
    
    // Reset payment section
    const paymentSection = document.querySelector('.payment-section');
    if (paymentSection) {
        const heading = paymentSection.querySelector('h3');
        const description = paymentSection.querySelector('p');
        
        if (heading) {
            heading.textContent = 'Complete Your Purchase';
            heading.style.color = '';
        }
        
        if (description) {
            description.textContent = 'You will be redirected to Stripe to complete your payment securely.';
            description.style.color = '';
            description.style.fontWeight = '';
        }
    }
    
    // Reset pricing display
    updatePricingDisplay(null);
    updateButtonText();
}

function updatePricingDisplay(coupon) {
    const pricingSection = document.querySelector('.pricing-summary');
    const priceDisplay = document.querySelector('.price-display');
    const amountSpan = document.querySelector('.amount');
    
    if (coupon) {
        // Calculate discounted price
        if (coupon.percent_off) {
            discountedPrice = originalPrice * (1 - coupon.percent_off / 100);
        } else if (coupon.amount_off) {
            discountedPrice = Math.max(0, originalPrice - (coupon.amount_off / 100));
        }
        
        // Add discounted class and update display
        pricingSection.classList.add('discounted');
        
        // Show original price crossed out
        if (!priceDisplay.querySelector('.original-price')) {
            const originalPriceSpan = document.createElement('span');
            originalPriceSpan.className = 'original-price';
            originalPriceSpan.innerHTML = `<span class="currency">$</span>${originalPrice}<span class="period">/month</span>`;
            priceDisplay.insertBefore(originalPriceSpan, priceDisplay.firstChild);
        }
        
        // Update main price to discounted price
        amountSpan.textContent = Math.round(discountedPrice);
        amountSpan.parentElement.classList.add('discounted-price');
        
        // Add discount badge
        if (!priceDisplay.querySelector('.discount-badge')) {
            const discountBadge = document.createElement('span');
            discountBadge.className = 'discount-badge';
            discountBadge.textContent = coupon.percent_off ? `${coupon.percent_off}% OFF` : `$${(coupon.amount_off / 100).toFixed(0)} OFF`;
            priceDisplay.appendChild(discountBadge);
        }
        
    } else {
        // Remove discount styling
        pricingSection.classList.remove('discounted');
        amountSpan.textContent = originalPrice;
        amountSpan.parentElement.classList.remove('discounted-price');
        
        // Remove discount elements
        const originalPriceSpan = priceDisplay.querySelector('.original-price');
        const discountBadge = priceDisplay.querySelector('.discount-badge');
        if (originalPriceSpan) originalPriceSpan.remove();
        if (discountBadge) discountBadge.remove();
    }
}

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
        referrer: document.referrer || 'direct',
        payment_method: appliedCoupon && discountedPrice === 0 ? 'free_coupon' : 'stripe_payment_link',
        coupon: appliedCoupon ? {
            code: appliedCoupon.id,
            discount_type: appliedCoupon.percent_off ? 'percent' : 'amount',
            discount_value: appliedCoupon.percent_off || appliedCoupon.amount_off
        } : null
    };

    // Store in sessionStorage for success page
    sessionStorage.setItem('checkoutData', JSON.stringify(checkoutData));

    // Also store in localStorage as backup (in case session is lost during redirect)
    localStorage.setItem('pendingAccountCreation', JSON.stringify(checkoutData));

    // Handle 100% discount (free) case - bypass Stripe
    if (appliedCoupon && discountedPrice === 0) {
        e.preventDefault(); // Prevent default Stripe redirect
        
        // Show loading state
        const buttonText = document.getElementById('button-text');
        if (buttonText) {
            buttonText.textContent = 'Processing free account...';
            stripeLinkButton.style.opacity = '0.7';
            stripeLinkButton.style.pointerEvents = 'none';
        }
        
        // Simulate payment success data for free account
        const freeAccountData = {
            ...checkoutData,
            payment_status: 'complete',
            amount_paid: 0,
            currency: 'usd',
            subscription_id: `free_${Date.now()}`,
            customer_id: `cus_free_${Date.now()}`,
            payment_intent_id: `pi_free_${Date.now()}`
        };
        
        // Store the "payment" data
        sessionStorage.setItem('paymentData', JSON.stringify(freeAccountData));
        localStorage.setItem('paymentData', JSON.stringify(freeAccountData));
        
        // Redirect to success page after a short delay
        setTimeout(() => {
            window.location.href = '/success.html?free_account=true&coupon=tacos';
        }, 1000);
        
        return;
    }

    // Update the Stripe Payment Link to include customer email and coupon data
    try {
        const url = new URL(paymentLink);
        url.searchParams.set('prefilled_email', email);
        url.searchParams.set('client_reference_id', `platform_${platform}_${Date.now()}`);
        
        // Add coupon to the payment link if applied
        if (appliedCoupon) {
            // Note: You'll need to create a new Stripe Payment Link with the coupon applied
            // or use Stripe Checkout Sessions instead for dynamic coupon application
            url.searchParams.set('coupon', appliedCoupon.id);
        }
        
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
        if (appliedCoupon && discountedPrice === 0) {
            // Free account - different button text
            if (platform) {
                const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
                buttonTextElement.textContent = `Start Free Download for ${platformName}`;
            } else {
                buttonTextElement.textContent = `Start Free Download`;
            }
        } else {
            // Paid account - normal payment flow
            if (platform) {
                const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
                const price = appliedCoupon ? `$${Math.round(discountedPrice)}` : '$20';
                buttonTextElement.textContent = `Proceed to Payment for ${platformName} - ${price}/month`;
            } else {
                const price = appliedCoupon ? `$${Math.round(discountedPrice)}` : '$20';
                buttonTextElement.textContent = `Proceed to Payment - ${price}/month`;
            }
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