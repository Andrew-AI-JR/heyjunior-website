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

    // Auto-detect and pre-select platform
    const detectedPlatform = detectUserPlatform();
    const platformRadio = document.querySelector(`input[name="platform"][value="${detectedPlatform}"]`);
    if (platformRadio) {
        platformRadio.checked = true;
        updateButtonText(); // Update button with detected platform
    }
    
    // Show what was detected
    const platformSection = document.querySelector('.platform-selection');
    if (platformSection) {
        const detectedLabel = document.createElement('div');
        detectedLabel.className = 'platform-detected';
        detectedLabel.style.cssText = `
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 10px;
            font-size: 0.9em;
            color: #0369a1;
        `;
        detectedLabel.innerHTML = `
            <span style="color: #059669;">✓</span> We detected you're using 
            <strong>${detectedPlatform === 'macos' ? 'macOS' : 'Windows'}</strong>
            <span style="opacity: 0.8; font-size: 0.85em;">(You can change this below if needed)</span>
        `;
        platformSection.insertBefore(detectedLabel, platformSection.firstChild);
    }

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
        // Hide the payment section entirely for 100% discount
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            paymentSection.style.display = 'none';
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
        // Show the payment section again
        paymentSection.style.display = 'block';
        
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

    // Handle 100% discount (free) case - bypass Stripe and start download immediately
    if (appliedCoupon && discountedPrice === 0) {
        e.preventDefault(); // Prevent default Stripe redirect
        
        // Show loading state
        const buttonText = document.getElementById('button-text');
        if (buttonText) {
            buttonText.textContent = 'Starting your free download...';
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
        
        // Start download immediately
        setTimeout(() => {
            startFreeDownload(platform, email);
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

// Platform mapping for download URLs
const PLATFORM_MAPPING = {
    'windows': 'windows',
    'macos': 'macos'
};

// Download URLs for actual working releases (updated to working URLs)
const DOWNLOAD_URLS = {
    'windows': 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.2/Junior-Desktop-Setup-1.0.2.exe',
    'macos': 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.2/Junior-Desktop-1.0.2.dmg'
};

function startFreeDownload(platform, email) {
    try {
        // Normalize platform name
        const normalizedPlatform = PLATFORM_MAPPING[platform] || 'windows';
        const downloadUrl = DOWNLOAD_URLS[normalizedPlatform];
        
        if (!downloadUrl) {
            throw new Error(`No download URL found for platform: ${platform}`);
        }
        
        const buttonText = document.getElementById('button-text');
        const stripeLinkButton = document.getElementById('stripe-payment-link-button');
        
        // Show success message
        if (buttonText) {
            buttonText.textContent = '🎉 Ready to Download!';
        }
        
        // Create a nice download ready message
        const downloadReadyDiv = document.createElement('div');
        downloadReadyDiv.className = 'download-ready-message';
        downloadReadyDiv.style.cssText = `
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
            animation: slideIn 0.5s ease-out;
        `;
        
        downloadReadyDiv.innerHTML = `
            <h3 style="margin: 0 0 10px 0; font-size: 1.3em;">🎉 Your Free Account is Ready!</h3>
            <p style="margin: 0 0 15px 0; opacity: 0.9;">
                Junior for ${platform === 'windows' ? 'Windows' : 'macOS'} is ready to download.
            </p>
            <button id="start-download-btn" style="
                background: rgba(255,255,255,0.2);
                border: 2px solid white;
                color: white;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 1.1em;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                margin: 10px;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
               onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                🚀 Download Now
            </button>
            <div style="font-size: 0.9em; opacity: 0.8; margin-top: 10px;">
                No payment required • 1 month free access
            </div>
        `;
        
        // Add animation CSS
        const animationStyle = document.createElement('style');
        animationStyle.textContent = `
            @keyframes slideIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(animationStyle);
        
        // Insert the message after the payment section
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            paymentSection.insertAdjacentElement('afterend', downloadReadyDiv);
        }
        
        // Add click handler for the download button
        document.getElementById('start-download-btn').addEventListener('click', function() {
            // User-initiated download (safe from security warnings)
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = downloadUrl.split('/').pop();
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Update the button to show download started
            this.innerHTML = '✅ Download Started!';
            this.style.background = 'rgba(255,255,255,0.3)';
            this.style.cursor = 'default';
            this.disabled = true;
            
            // Show success message and redirect after download starts
            setTimeout(() => {
                // Generate a simple API key for offline mode
                const apiKey = generateOfflineApiKey(email);
                
                // Redirect to success page with free account info
                const successUrl = new URL('/success.html', window.location.origin);
                successUrl.searchParams.set('free_account', 'true');
                successUrl.searchParams.set('coupon', 'tacos');
                successUrl.searchParams.set('download_started', 'true');
                successUrl.searchParams.set('api_key', apiKey);
                
                window.location.href = successUrl.toString();
            }, 2000);
        });
        
    } catch (error) {
        console.error('Download setup failed:', error);
        
        // Reset button state
        const buttonText = document.getElementById('button-text');
        const stripeLinkButton = document.getElementById('stripe-payment-link-button');
        
        if (buttonText) {
            buttonText.textContent = 'Download Setup Failed - Try Again';
        }
        if (stripeLinkButton) {
            stripeLinkButton.style.opacity = '1';
            stripeLinkButton.style.pointerEvents = 'auto';
        }
        
        alert('Download setup failed. Please try again or contact support.');
    }
}

function generateOfflineApiKey(email) {
    // Generate a simple API key for offline mode
    const timestamp = Date.now();
    const emailHash = btoa(email).substring(0, 8);
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    return `offline_${emailHash}_${timestamp}_${randomSuffix}`;
}

// Auto-detect user's platform
function detectUserPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    if (platform.includes('mac') || userAgent.includes('mac')) {
        return 'macos';
    } else if (platform.includes('win') || userAgent.includes('windows')) {
        return 'windows';
    } else {
        // Default to Windows for other platforms (Linux users often know what they want)
        return 'windows';
    }
}

// Alternative: Complete auto-detection (uncomment to use)
/*
// For completely automatic platform detection, replace platform selection HTML with:
// <div class="platform-auto-detected">
//   <span id="detected-platform-display">Detecting your platform...</span>
// </div>

function handleFullAutoDetection() {
    const detectedPlatform = detectUserPlatform();
    const displayElement = document.getElementById('detected-platform-display');
    
    if (displayElement) {
        displayElement.innerHTML = `
            <span style="color: #059669;">✓</span> Download for 
            <strong>${detectedPlatform === 'macos' ? 'macOS' : 'Windows'}</strong>
            <button onclick="togglePlatform()" style="
                background: none; border: none; color: #0ea5e9; 
                text-decoration: underline; cursor: pointer; font-size: inherit;
                margin-left: 8px;
            ">Change</button>
        `;
    }
    
    // Set the platform without radio buttons
    window.selectedPlatform = detectedPlatform;
    updateButtonText();
}
*/ 