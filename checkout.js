/* checkout.js - Integrated Account Creation and Payment Flow */
document.addEventListener('DOMContentLoaded', () => {
  // Add event listeners
  document.getElementById('create-account-button')?.addEventListener('click', handleAccountCreationWithPayment);


  // Platform selection listeners
  document.querySelectorAll('input[name="platform"]').forEach(radio => {
    radio.addEventListener('change', updateButtonText);
  });



  // Password confirmation validation
  document.getElementById('confirm-password')?.addEventListener('input', validatePasswordMatch);
  document.getElementById('customer-password')?.addEventListener('input', validatePasswordMatch);

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

  // Debug: Ensure button text is set
  console.log('Button text initialized:', document.getElementById('button-text')?.textContent);
});



// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://api.heyjunior.ai';
const STRIPE_PRICE_ID = 'price_1RNwNFRxE6F23RwQe0JfuKZz'; // Replace with your actual Stripe price ID

async function handleAccountCreationWithPayment(e) {
  e.preventDefault();

  const button = document.getElementById('create-account-button');
  const buttonText = document.getElementById('button-text');
  const errorDiv = document.getElementById('checkout-error');

  // Get form values
  const email = document.getElementById('customer-email').value.trim();
  const password = document.getElementById('customer-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const platform = document.querySelector('input[name="platform"]:checked')?.value;


  // Clear previous errors
  errorDiv.style.display = 'none';

  // Validate form
  const validationError = validateForm(email, password, confirmPassword, platform);
  if (validationError) {
    showError(validationError);
    return;
  }

  // Show loading state
  button.disabled = true;
  buttonText.textContent = 'Creating account...';

  try {
    // Store platform selection for later
    sessionStorage.setItem('selectedPlatform', platform);

    // Call the integrated API endpoint
    const response = await fetch(`${API_BASE_URL}/api/users/create-with-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password,
        price_id: STRIPE_PRICE_ID,
        success_url: `${window.location.origin}/success.html`,
        cancel_url: `${window.location.origin}/checkout.html`,
        coupon_code: null
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Account creation failed');
    }

    if (data.success) {
      // Store user information for success page
      sessionStorage.setItem('userId', data.user_id);
      sessionStorage.setItem('customerId', data.customer_id);
      sessionStorage.setItem('userEmail', email);

      // Store checkout data for potential later use
      const checkoutData = {
        email: email,
        platform: platform,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer || 'direct',
        payment_method: 'integrated_checkout',
        coupon: null
      };

      sessionStorage.setItem('checkoutData', JSON.stringify(checkoutData));
      localStorage.setItem('pendingAccountCreation', JSON.stringify(checkoutData));

      // Update button text
      buttonText.textContent = 'Redirecting to payment...';

      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url;
    } else {
      throw new Error('Account creation failed');
    }

  } catch (error) {
    console.error('Account creation error:', error);
    showError(error.message || 'Failed to create account. Please try again.');

    // Reset button state
    button.disabled = false;
    updateButtonText();
  }
}

function validateForm(email, password, confirmPassword, platform) {
  if (!email || !validateEmail(email)) {
    return 'Please enter a valid email address.';
  }

  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }

  if (!platform) {
    return 'Please select your platform (Windows or macOS).';
  }

  return null;
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePasswordMatch() {
  const password = document.getElementById('customer-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const confirmInput = document.getElementById('confirm-password');

  if (confirmPassword && password !== confirmPassword) {
    confirmInput.style.borderColor = '#ef4444';
    confirmInput.setCustomValidity('Passwords do not match');
  } else {
    confirmInput.style.borderColor = '#d1d5db';
    confirmInput.setCustomValidity('');
  }
}

function showError(message) {
  const errorDiv = document.getElementById('checkout-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  // Scroll to error message
  errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}











function updateButtonText() {
  const buttonText = document.getElementById('button-text');
  if (!buttonText) {
    console.error('Button text element not found!');
    return;
  }

  const platform = document.querySelector('input[name="platform"]:checked')?.value;
  const platformName = platform === 'macos' ? 'macOS' : 'Windows';

  const newText = `Create Account & Subscribe - $20/month (${platformName})`;

  buttonText.textContent = newText;
  console.log('Button text updated to:', newText);
}

function detectUserPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('mac')) {
    return 'macos';
  } else if (userAgent.includes('win')) {
    return 'windows';
  }

  // Default to Windows if can't detect
  return 'windows';
}
