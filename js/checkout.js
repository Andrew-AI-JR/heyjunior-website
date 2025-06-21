/* checkout.js - Integrated Account Creation and Payment Flow */

// Prevent extension communication errors from breaking the page
window.addEventListener('error', function (e) {
  if (e.message && e.message.includes('Could not establish connection')) {
    console.warn('Extension communication error ignored:', e.message);
    e.preventDefault();
    return true;
  }
});

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
    const detectedText = window.i18nUtils ?
      `<span style="color: #059669;">✓</span> ${window.i18nUtils.translate('checkout.platformDetected')} <strong>${detectedPlatform === 'macos' ? 'macOS' : 'Windows'}</strong>` :
      `<span style="color: #059669;">✓</span> We detected you're using <strong>${detectedPlatform === 'macos' ? 'macOS' : 'Windows'}</strong>`;
    detectedLabel.innerHTML = `${detectedText}
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
  buttonText.textContent = window.i18nUtils ? window.i18nUtils.translate('checkout.processing') : 'Creating account...';

  try {
    // Store platform selection for later
    sessionStorage.setItem('selectedPlatform', platform);

    console.log('Sending request to:', `${API_BASE_URL}/api/users/create-with-payment`);

    // Create abort controller for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
      }),
      signal: controller.signal
    });

    // Clear timeout if request completes
    clearTimeout(timeoutId);

    const data = await response.json();

    console.log('API Response:', {
      status: response.status,
      statusText: response.statusText,
      data: data
    });

    if (!response.ok) {
      // Handle 422 validation errors specifically
      if (response.status === 422 && data.detail && Array.isArray(data.detail)) {
        const validationErrors = data.detail.map(error => {
          const field = error.loc ? error.loc[error.loc.length - 1] : 'field';
          return `${field}: ${error.msg}`;
        }).join('\n');
        throw new Error(`Validation failed:\n${validationErrors}`);
      }

      // Handle 409 account already exists error
      if (response.status === 409) {
        const errorMessage = data.detail || 'An account with this email address already exists.';
        throw new Error(errorMessage);
      }

      // Handle other error formats
      const errorMessage = data.detail || data.message || `Server error (${response.status})`;
      throw new Error(errorMessage);
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
      buttonText.textContent = window.i18nUtils ? window.i18nUtils.translate('checkout.processing') : 'Redirecting to payment...';

      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url;
    } else {
      throw new Error('Account creation failed');
    }

  } catch (error) {
    console.error('Account creation error:', error);

    // Format error message for better user experience
    let userMessage = error.message || 'Failed to create account. Please try again.';

    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      userMessage = 'Network error. Please check your internet connection and try again.';
    }

    // Handle timeout errors
    if (error.name === 'AbortError') {
      userMessage = 'Request timed out. Please try again.';
    }

    // Handle validation errors (preserve line breaks for multiple validation errors)
    if (userMessage.includes('Validation failed:')) {
      userMessage = userMessage.replace(/\n/g, '<br>');
    }

    showError(userMessage);

    // Reset button state
    button.disabled = false;
    updateButtonText();
  }
}

// Add global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
  console.error('Unhandled promise rejection:', event.reason);

  // Prevent the error from appearing in console as unhandled
  event.preventDefault();

  // Show user-friendly error if it's related to our checkout
  if (event.reason && event.reason.message &&
    (event.reason.message.includes('fetch') ||
      event.reason.message.includes('create-with-payment'))) {
    const errorDiv = document.getElementById('checkout-error');
    if (errorDiv) {
      showError('An unexpected error occurred. Please refresh the page and try again.');
    }
  }
});

function validateForm(email, password, confirmPassword, platform) {
  if (!email || !validateEmail(email)) {
    return 'Please enter a valid email address.';
  }

  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  // Check for uppercase letter requirement
  if (!password.match(/[A-Z]/)) {
    return 'Password must contain at least one uppercase letter.';
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

  // Use innerHTML for formatted messages, but sanitize first
  if (message.includes('<br>')) {
    errorDiv.innerHTML = message;
  } else {
    errorDiv.textContent = message;
  }

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

  const baseText = window.i18nUtils ? window.i18nUtils.translate('checkout.createAccount') : 'Create Account & Subscribe - $20/month';
  const newText = `${baseText} (${platformName})`;

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
