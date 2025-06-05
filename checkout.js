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

    // Add listeners for email and platform changes when coupon is applied
    const emailInput = document.getElementById('customer-email');
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            if (appliedCoupon && discountedPrice === 0) {
                showCouponDiscount(appliedCoupon);
            }
        });
    }
    
    document.querySelectorAll('input[name="platform"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateButtonText();
            if (appliedCoupon && discountedPrice === 0) {
                showCouponDiscount(appliedCoupon);
            }
        });
    });
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('https://junior-api-915940312680.us-west1.run.app/api/payments/validate-coupon', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                coupon_code: couponCode
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
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
        // If backend is down, check for other frontend-only coupons or show more helpful error
        if (error.name === 'TypeError' || error.message.includes('fetch')) {
            showCouponMessage('Unable to validate coupon - please try again later', 'error');
        } else {
            showCouponMessage('Invalid coupon code', 'error');
        }
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
        // Hide the payment section for 100% discount
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            paymentSection.style.display = 'none';
        }
        
        // Show download button for free accounts
        const email = document.getElementById('customer-email').value;
        const platform = document.querySelector('input[name="platform"]:checked')?.value;
        
        if (email && platform) {
            // Remove any existing download sections first
            const existingDownloadSections = document.querySelectorAll('#free-download-section, .download-ready-message');
            existingDownloadSections.forEach(section => section.remove());
            
            // Create new download section
            const downloadSection = document.createElement('div');
            downloadSection.id = 'free-download-section';
            downloadSection.className = 'download-ready-message';
            downloadSection.style.cssText = `
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                animation: slideIn 0.5s ease-out;
            `;
            
            downloadSection.innerHTML = `
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
            
            // Insert after payment section or at end of form
            if (paymentSection) {
                paymentSection.insertAdjacentElement('afterend', downloadSection);
            } else {
                const formElement = document.querySelector('.checkout-form');
                if (formElement) {
                    formElement.appendChild(downloadSection);
                }
            }
            
            // Add click handler directly - this will initiate the download immediately
            const downloadBtn = downloadSection.querySelector('#start-download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Re-read current values to avoid stale closures
                    const currentEmail = document.getElementById('customer-email').value;
                    const currentPlatform = document.querySelector('input[name="platform"]:checked')?.value;
                    
                    console.log('Button clicked - Starting download immediately:', { currentEmail, currentPlatform });
                    
                    // Start download immediately without creating another section
                    await initiateDownload(currentPlatform, currentEmail, this);
                });
            }
        } else {
            // Show message to complete form
            let downloadSection = document.getElementById('free-download-section');
            if (!downloadSection) {
                downloadSection = document.createElement('div');
                downloadSection.id = 'free-download-section';
                downloadSection.className = 'download-ready-message';
                downloadSection.style.cssText = `
                    background: #fef3c7;
                    border: 1px solid #f59e0b;
                    color: #92400e;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 20px 0;
                    text-align: center;
                `;
                
                const paymentSection = document.querySelector('.payment-section');
                if (paymentSection) {
                    paymentSection.insertAdjacentElement('afterend', downloadSection);
                } else {
                    const formElement = document.querySelector('.checkout-form');
                    if (formElement) {
                        formElement.appendChild(downloadSection);
                    }
                }
            }
            
            downloadSection.innerHTML = `
                <p style="margin: 0; font-weight: 500;">
                    Please enter your email and select your platform above to continue with your free download.
                </p>
            `;
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
        setTimeout(async () => {
            await startFreeDownload(platform, email);
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

// GitHub configuration for private repository access
const GITHUB_CONFIG = {
    token: atob('Z2hwX094a1RjaWxDWmRsNGFMa3p1M1V0bjRhYzdHbzMzcjFCbUJCdg=='),
    repo: 'Andrew-AI-JR/junior-desktop',
    releaseTag: 'v1.0.1'
};

// Asset names in the GitHub release
const GITHUB_ASSETS = {
    windows: 'Junior-Setup-v1.0.1.exe',
    macos: 'Junior-v1.0.1.dmg',
    macos_arm: 'Junior-v1.0.1-arm64.dmg'
};

// Function to get authenticated download URL from GitHub API
async function getGitHubDownloadUrl(platform) {
    const assetName = GITHUB_ASSETS[platform] || GITHUB_ASSETS['windows'];
    console.log('Looking for GitHub asset:', assetName);
    
    try {
        // Get release information from GitHub API
        const releaseUrl = `https://api.github.com/repos/${GITHUB_CONFIG.repo}/releases/tags/${GITHUB_CONFIG.releaseTag}`;
        const response = await fetch(releaseUrl, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const release = await response.json();
        console.log('GitHub release found:', release.name);
        
        // Find the asset for this platform
        const asset = release.assets.find(asset => asset.name === assetName);
        if (!asset) {
            throw new Error(`Asset "${assetName}" not found in release. Available assets: ${release.assets.map(a => a.name).join(', ')}`);
        }
        
        console.log('GitHub asset found:', asset.name, 'Size:', asset.size, 'bytes');
        
        // Return the authenticated download URL
        return {
            url: asset.url,
            name: asset.name,
            size: asset.size
        };
        
    } catch (error) {
        console.error('Failed to get GitHub download URL:', error);
        throw error;
    }
}

// New function that handles download without creating duplicate sections
async function initiateDownload(platform, email, buttonElement) {
    console.log('Initiating download for:', { platform, email });
    console.log('Platform type:', typeof platform);
    console.log('Platform value:', JSON.stringify(platform));
    
    try {
        // Update button to show fetching state
        buttonElement.innerHTML = '🔍 Getting download link...';
        buttonElement.style.background = 'rgba(255,255,255,0.3)';
        buttonElement.disabled = true;
        
        // Get authenticated download URL from GitHub
        const downloadInfo = await getGitHubDownloadUrl(platform);
        console.log('Download info received:', downloadInfo);
        
        // Update button to show downloading state
        buttonElement.innerHTML = '⏳ Starting download...';
        
        // Create authenticated download request
        const downloadResponse = await fetch(downloadInfo.url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/octet-stream'
            }
        });
        
        if (!downloadResponse.ok) {
            throw new Error(`Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
        }
        
        // Get the blob and create download URL
        const blob = await downloadResponse.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        
        // User-initiated download (safe from security warnings)
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadInfo.name; // Use the actual filename from GitHub
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL after a short delay
        setTimeout(() => {
            window.URL.revokeObjectURL(downloadUrl);
        }, 1000);
        
        // Update the button to show download started
        buttonElement.innerHTML = '✅ Download Started!';
        buttonElement.style.cursor = 'default';
        
        // Show success message and redirect after download starts
        setTimeout(() => {
            // Redirect to success page with free account info
            const successUrl = new URL('/success.html', window.location.origin);
            successUrl.searchParams.set('free_account', 'true');
            successUrl.searchParams.set('coupon', 'tacos');
            successUrl.searchParams.set('download_started', 'true');
            
            window.location.href = successUrl.toString();
        }, 2000);
        
    } catch (error) {
        console.error('Download failed:', error);
        
        // Reset button state
        buttonElement.innerHTML = '❌ Download Failed - Try Again';
        buttonElement.style.background = 'rgba(255,255,255,0.2)';
        buttonElement.style.cursor = 'pointer';
        buttonElement.disabled = false;
        
        alert('Download failed. Please try again or contact support.');
    }
}

// Legacy function kept for compatibility - now just calls initiateDownload
async function startFreeDownload(platform, email) {
    console.log('startFreeDownload called - this should not create duplicate sections');
    
    // Find existing download button and use it
    const existingDownloadBtn = document.getElementById('start-download-btn');
    if (existingDownloadBtn) {
        await initiateDownload(platform, email, existingDownloadBtn);
        return;
    }
    
    // Fallback: if no existing button, show error
    console.error('No existing download button found - this should not happen');
    alert('Download setup error. Please refresh and try again.');
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

// Add this helper function for the download button
window.startFreeDownloadFromButton = function() {
    const email = document.getElementById('customer-email').value;
    const platform = document.querySelector('input[name="platform"]:checked')?.value;
    
    if (email && platform) {
        startFreeDownload(platform, email);
    }
};

// Update platform selection to handle M1/M2 Macs
function handlePlatformSelection() {
    const platform = document.querySelector('input[name="platform"]:checked').value;
    const isMacArm = platform === 'macos' && window.navigator.platform.includes('Mac') && 
                     (window.navigator.userAgent.includes('ARM') || window.navigator.userAgent.includes('Apple Silicon'));
    
    return isMacArm ? DOWNLOAD_URLS.macos_arm : DOWNLOAD_URLS[platform];
} 