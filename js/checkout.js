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
  console.log('DOMContentLoaded fired.');
  // Add event listeners for main actions that do not depend on i18n
  document.getElementById('create-account-button')?.addEventListener('click', handleCheckoutAction);

  // Password confirmation validation
  document.getElementById('confirm-password')?.addEventListener('input', validatePasswordMatch);
  document.getElementById('customer-password')?.addEventListener('input', validatePasswordMatch);
});

// Function to set up event listeners that depend on i18n
function setupEventListeners() {
  // Platform selection listeners
  document.querySelectorAll('input[name="platform"]').forEach(radio => {
    radio.addEventListener('change', () => updateButtonText(document.getElementById('create-account-button')));
  });
}

// Function to initialize UI elements that depend on i18n
function initializeCheckoutUI() {
  const detectedPlatform = detectUserPlatform();
  const platformRadio = document.querySelector(`input[name="platform"][value="${detectedPlatform}"]`);
  if (platformRadio) {
    platformRadio.checked = true;
  }

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
    const detectedText = `<span style="color: #059669;">✓</span> ${window.i18nUtils.translate('checkout.platformDetected')} <strong>${detectedPlatform === 'macos' ? 'macOS' : detectedPlatform === 'linux' ? window.i18nUtils.translate('checkout.linux') : 'Windows'}</strong>`;
    detectedLabel.innerHTML = `${detectedText}
            <span style="opacity: 0.8; font-size: 0.85em;">${window.i18nUtils.translate('checkout.platformNoteChange')}</span>
        `;
    platformSection.insertBefore(detectedLabel, platformSection.firstChild);
  }

  const initialCreateAccountButton = document.getElementById('create-account-button');
  if (initialCreateAccountButton) {
    updateButtonText(initialCreateAccountButton);
  }

}

// Listen for the i18nInitialized event
window.addEventListener('i18nInitialized', () => {
  console.log('i18nInitialized event received in checkout.js');
  initializeCheckoutUI();
  setupEventListeners();

  // Enable button after i18n is initialized
  document.getElementById('create-account-button').disabled = false;
});


// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? window.location.origin.replace(/:\d+$/, ':8000') : 'https://api.heyjunior.ai';
const STRIPE_PRICE_ID = 'price_1RNwNFRxE6F23RwQe0JfuKZz'; // Replace with your actual Stripe price ID

// Global variables to manage token refresh state
let isRefreshingToken = false;
let tokenRefreshQueue = [];
let currentUserToken = null; // Define currentUserToken globally

async function refreshToken() {
  if (isRefreshingToken) {
    return new Promise((resolve) => {
      tokenRefreshQueue.push(resolve);
    });
  }

  isRefreshingToken = true;
  const storedRefreshToken = sessionStorage.getItem('refreshToken');
  if (!storedRefreshToken) {
    console.error('No refresh token available.');
    isRefreshingToken = false;
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/users/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: storedRefreshToken }),
    });

    const data = await response.json();

    if (response.ok && data.access_token) {
      sessionStorage.setItem('userToken', data.access_token);
      currentUserToken = data.access_token;
      console.log('Token refreshed successfully.');
      tokenRefreshQueue.forEach(resolve => resolve(data.access_token));
      tokenRefreshQueue = [];
      return data.access_token;
    } else {
      console.error('Failed to refresh token:', data.detail || data.message);
      // Clear session and force re-login if refresh token is invalid
      sessionStorage.clear();
      currentUserToken = null;
      window.location.reload(); // Or redirect to login page
      return null;
    }
  } catch (error) {
    console.error('Network error during token refresh:', error);
    sessionStorage.clear();
    currentUserToken = null;
    window.location.reload(); // Or redirect to login page
    return null;
  } finally {
    isRefreshingToken = false;
  }
}

async function fetchWithAuth(url, options = {}) {
  let token = currentUserToken || sessionStorage.getItem('userToken');
  let headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    console.warn('Access token expired or invalid. Attempting to refresh...');
    const newAccessToken = await refreshToken();
    if (newAccessToken) {
      headers['Authorization'] = `Bearer ${newAccessToken}`;
      // Retry the original request with the new token
      response = await fetch(url, { ...options, headers });
    } else {
      // If token refresh failed, clear session and force re-login
      sessionStorage.clear();
      currentUserToken = null;
      window.location.reload(); // Or redirect to login page
      return response; // Return the 401 response
    }
  }
  return response;
}

async function handleCheckoutAction(e) {
  e.preventDefault();

  const button = e.target;
  const buttonTextElement = button.querySelector('#button-text') || button;
  const errorDiv = document.getElementById('checkout-error');

  // Clear previous errors
  errorDiv.style.display = 'none';

  const email = document.getElementById('customer-email').value.trim();
  const password = document.getElementById('customer-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const platform = document.querySelector('input[name="platform"]:checked')?.value;

  // Validate form
  const validationError = validateForm(email, password, confirmPassword, platform);
  if (validationError) {
    showError(validationError);
    return;
  }

  // Show loading state
  button.disabled = true;
  buttonTextElement.textContent = window.i18nUtils ? window.i18nUtils.translate('checkout.processing') : 'Processing...';

  try {
    sessionStorage.setItem('selectedPlatform', platform); // Store platform selection for later

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const apiUrl = `${API_BASE_URL}/api/users/create-with-payment`;
    const requestBody = {
      email: email,
      password: password,
      price_id: STRIPE_PRICE_ID,
      success_url: `${window.location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}&user_id=${encodeURIComponent(email)}`,
      cancel_url: `${window.location.origin}/checkout.html`,
      coupon_code: null,
      metadata: {
        platform: platform,
        user_email: email
      },
      payment_intent_data: {
        metadata: {
          user_email: email,
          platform: platform
        }
      },
      subscription_data: {
        metadata: {
          user_email: email,
          platform: platform
        }
      }
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    console.log('API Response:', {
      status: response.status,
      statusText: response.statusText,
      data: data
    });

    if (!response.ok) {
      if (response.status === 422 && data.detail && Array.isArray(data.detail)) {
        const validationErrors = data.detail.map(error => {
          const field = error.loc ? error.loc[error.loc.length - 1] : 'field';
          return `${field}: ${error.msg}`;
        }).join('\n');
        throw new Error(`Validation failed:\n${validationErrors}`);
      }

      if (response.status === 409) {
        const errorMessage = data.detail || 'An account with this email address already exists. Please use a different email or contact support.';
        showError(errorMessage);
        return; // Stop further processing
      }

      const errorMessage = data.detail || data.message || `Server error (${response.status})`;
      throw new Error(errorMessage);
    }

    // Save account data
    if (data.success) {
      sessionStorage.setItem('userId', data.user_id);
      sessionStorage.setItem('customerId', data.customer_id);
      sessionStorage.setItem('userEmail', email);
      if (data.token) {
        sessionStorage.setItem('userToken', data.token);
        currentUserToken = data.token;
      }
    } else {
      throw new Error('Account creation failed');
    }

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

    buttonTextElement.textContent = window.i18nUtils ? window.i18nUtils.translate('checkout.redirecting') : 'Redirecting to payment...';
    window.location.href = data.checkout_url;

  } catch (error) {
    console.error('Checkout action error:', error);
    let userMessage = error.message || (window.i18nUtils ? window.i18nUtils.translate('checkout.genericError') : 'Failed to complete action. Please try again.');

    if (error.name === 'TypeError' && userMessage.includes('fetch')) {
      userMessage = window.i18nUtils ? window.i18nUtils.translate('checkout.networkError') : 'Network error. Please check your internet connection and try again.';
    }
    if (error.name === 'AbortError') {
      userMessage = window.i18nUtils ? window.i18nUtils.translate('checkout.timeoutError') : 'Request timed out. Please try again.';
    }
    if (userMessage.includes('Validation failed:')) {
      userMessage = userMessage.replace(/\n/g, '<br>');
    }

    showError(userMessage);
    button.disabled = false;
    updateButtonText(button);
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











function updateButtonText(buttonElement) {
  const platform = document.querySelector('input[name="platform"]:checked')?.value;
  const platformName = platform === 'macos' ? 'macOS' : (platform === 'linux' ? 'Linux' : 'Windows');

  const baseText = 'Continue to Payment - $20/month';
  const newText = `${baseText} (${platformName})`;

  const textSpan = buttonElement.querySelector('#button-text');
  if (textSpan) {
    textSpan.textContent = newText;
  } else {
    buttonElement.textContent = newText;
  }
  console.log('Button text updated to:', newText);
}

function detectUserPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('mac')) {
    return 'macos';
  } else if (userAgent.includes('win')) {
    return 'windows';
  } else if (userAgent.includes('linux')) {
    return 'linux'; // Return 'linux' for Linux users
  }

  // Default to Windows if can't detect
  return 'windows';
}
