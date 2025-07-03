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
  document.getElementById('login-button')?.addEventListener('click', handleLogin);
  document.getElementById('buy-new-subscription-button')?.addEventListener('click', handleCheckoutAction);

  // Password confirmation validation
  document.getElementById('confirm-password')?.addEventListener('input', validatePasswordMatch);
  document.getElementById('customer-password')?.addEventListener('input', validatePasswordMatch);
});

// Function to set up event listeners that depend on i18n
function setupEventListeners() {
  const showCreateAccountButton = document.getElementById('show-create-account');
  const showLoginButton = document.getElementById('show-login');

  if (showCreateAccountButton) {
    showCreateAccountButton.addEventListener('click', () => toggleForm('create-account'));
    console.log('show-create-account button found and listener attached.');
  } else {
    console.error('show-create-account button not found!');
  }

  if (showLoginButton) {
    showLoginButton.addEventListener('click', () => toggleForm('login'));
    console.log('show-login button found and listener attached.');
  } else {
    console.error('show-login button not found!');
  }

  // Platform selection listeners
  document.querySelectorAll('input[name="platform"]').forEach(radio => {
    radio.addEventListener('change', () => updateButtonText(document.getElementById('create-account-button')));
  });
}

// Function to set up event listeners that depend on i18n
function setupEventListeners() {
  const showCreateAccountButton = document.getElementById('show-create-account');
  const showLoginButton = document.getElementById('show-login');

  if (showCreateAccountButton) {
    showCreateAccountButton.addEventListener('click', () => toggleForm('create-account'));
    console.log('show-create-account button found and listener attached.');
  } else {
    console.error('show-create-account button not found!');
  }

  if (showLoginButton) {
    showLoginButton.addEventListener('click', () => toggleForm('login'));
    console.log('show-login button found and listener attached.');
  } else {
    console.error('show-login button not found!');
  }

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

  const buyNewSubscriptionButton = document.getElementById('buy-new-subscription-button');
  if (buyNewSubscriptionButton) {
    updateButtonText(buyNewSubscriptionButton);
  }

  // Check for existing session or pending login after i18n is ready
  handleInitialSession();
}

// Function to handle initial session check and subscription fetching
function handleInitialSession() {
  currentUserToken = sessionStorage.getItem('userToken'); // Initialize currentUserToken from session storage
  const userEmail = sessionStorage.getItem('userEmail');
  if (currentUserToken && userEmail) {
    console.log('User already logged in. Fetching subscriptions...');
    toggleForm('subscriptions');
  }
}

// Listen for the i18nInitialized event
window.addEventListener('i18nInitialized', () => {
  console.log('i18nInitialized event received in checkout.js');
  initializeCheckoutUI();
  setupEventListeners();

  // Enable buttons after i18n is initialized
  document.getElementById('create-account-button').disabled = false;
  document.getElementById('login-button').disabled = false;
  document.getElementById('buy-new-subscription-button').disabled = false;

  // Explicitly re-fetch subscriptions if user is logged in, to update translations
  currentUserToken = sessionStorage.getItem('userToken'); // Ensure currentUserToken is up-to-date
  const userEmail = sessionStorage.getItem('userEmail');
  if (currentUserToken && userEmail) {
    console.log('User logged in, re-fetching subscriptions for translation update...');
    fetchUserSubscriptions(currentUserToken);
  }
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

  // Determine if we are creating an account or buying a new subscription
  const isCreatingAccount = document.getElementById('create-account-form').style.display !== 'none';
  const isBuyingNewSubscription = document.getElementById('subscriptions-display').style.display !== 'none';

  // Clear previous errors
  errorDiv.style.display = 'none';

  let email, password, confirmPassword;
  if (isCreatingAccount) {
    email = document.getElementById('customer-email').value.trim();
    password = document.getElementById('customer-password').value;
    confirmPassword = document.getElementById('confirm-password').value;
  } else if (isBuyingNewSubscription) {
    email = sessionStorage.getItem('userEmail'); // Get email from session for logged-in user
    password = null; // Not needed for buying new subscription
    confirmPassword = null; // Not needed for buying new subscription
  }

  const platform = document.querySelector('input[name="platform"]:checked')?.value;

  // Validate form based on current action
  let validationError = null;
  if (isCreatingAccount) {
    validationError = validateForm(email, password, confirmPassword, platform);
  } else if (isBuyingNewSubscription) {
    if (!platform) {
      validationError = window.i18nUtils ? window.i18nUtils.translate('checkout.platformRequired') : 'Please select your platform (Windows or macOS).';
    }
  }

  if (validationError) {
    showError(validationError);
    return;
  }

  // Show loading state
  button.disabled = true;
  buttonTextElement.textContent = window.i18nUtils ? window.i18nUtils.translate('checkout.processing') : 'Processing...';

  try {
    sessionStorage.setItem('selectedPlatform', platform); // Store platform selection for later

    let apiUrl = '';
    let requestBody = {};

    if (isCreatingAccount) {
      apiUrl = `${API_BASE_URL}/api/users/create-with-payment`;
      requestBody = {
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
      }),
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

      if (response.status === 409 && isCreatingAccount) {
        const errorMessage = data.detail || (window.i18nUtils ? window.i18nUtils.translate('checkout.accountExistsLoginPrompt') : 'An account with this email address already exists. Please log in instead.');
        showError(errorMessage);
        toggleForm('login'); // Switch to login form
        document.getElementById('login-email').value = email; // Pre-fill email
        return; // Stop further processing
      }

      const errorMessage = data.detail || data.message || `Server error (${response.status})`;
      throw new Error(errorMessage);
    }

    if (isCreatingAccount) {
      if (data.success) {
        sessionStorage.setItem('userId', data.user_id);
        sessionStorage.setItem('customerId', data.customer_id);
        sessionStorage.setItem('userEmail', email);
        if (data.token) { // Save token if provided (e.g., after login)
          sessionStorage.setItem('userToken', data.token);
          currentUserToken = data.token;
        }
      } else {
        throw new Error('Operation failed');
      }
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

async function handleLogin(e) {
  console.log('Login button clicked');
  e.preventDefault();

  const button = document.getElementById('login-button');
  const errorDiv = document.getElementById('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  errorDiv.style.display = 'none';

  if (!email || !validateEmail(email)) {
    showError(window.i18nUtils ? window.i18nUtils.translate('checkout.invalidEmail') : 'Please enter a valid email address.', 'login-error');
    return;
  }
  if (!password) {
    showError(window.i18nUtils ? window.i18nUtils.translate('checkout.passwordRequired') : 'Please enter your password.', 'login-error');
    return;
  }

  button.disabled = true;
  button.textContent = window.i18nUtils ? window.i18nUtils.translate('checkout.loggingIn') : 'Logging in...';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${API_BASE_URL}/api/users/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.detail || data.message || (window.i18nUtils ? window.i18nUtils.translate('checkout.loginFailed') : 'Login failed. Please check your credentials.');
      throw new Error(errorMessage);
    }

    if (data.access_token) {
      sessionStorage.setItem('userToken', data.access_token);
      sessionStorage.setItem('userEmail', email); // Store email for display/future use
      if (data.refresh_token) {
        sessionStorage.setItem('refreshToken', data.refresh_token);
      }
      currentUserToken = data.access_token;
      console.log('Login successful. Token:', data.access_token);
      toggleForm('subscriptions');
      fetchUserSubscriptions(data.access_token);
    } else {
      throw new Error(window.i18nUtils ? window.i18nUtils.translate('checkout.loginFailed') : 'Login failed. No token received.');
    }

  } catch (error) {
    console.error('Login error:', error);
    let userMessage = error.message || (window.i18nUtils ? window.i18nUtils.translate('checkout.genericError') : 'An error occurred during login.');
    showError(userMessage, 'login-error');
    button.disabled = false;
    updateButtonText(button);
  }
}

async function fetchUserSubscriptions(token) {
  const subscriptionListDiv = document.getElementById('subscription-list');
  const subscriptionStatsContainer = document.getElementById('subscription-stats-container');
  const buyNewSubscriptionButton = document.getElementById('buy-new-subscription-button');

  subscriptionListDiv.innerHTML = window.i18nUtils ? window.i18nUtils.translate('checkout.loadingSubscriptions') : '<p>Loading subscriptions...</p>';
  subscriptionStatsContainer.innerHTML = ''; // Clear any previous stats
  buyNewSubscriptionButton.disabled = true;

  // Clear previous stats and subscriptions to prevent duplication on re-render
  subscriptionListDiv.innerHTML = '';
  subscriptionStatsContainer.innerHTML = '';

  try {
    // Fetch all subscriptions
    const allSubscriptionsResponse = await fetchWithAuth(`${API_BASE_URL}/api/subscription/all`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const allSubscriptionsData = await allSubscriptionsResponse.json();

    if (!allSubscriptionsResponse.ok) {
      throw new Error(allSubscriptionsData.detail || 'Failed to fetch all subscriptions.');
    }

    subscriptionListDiv.innerHTML = ''; // Clear loading message

    if (allSubscriptionsData.subscriptions && allSubscriptionsData.subscriptions.length > 0) {
      allSubscriptionsData.subscriptions.forEach(sub => {
        const subDiv = document.createElement('div');
        subDiv.className = 'subscription-item';
        subDiv.innerHTML = `
          <p><strong>${sub.product_name || 'Subscription'}</strong></p>
          <p>${window.i18nUtils ? window.i18nUtils.translate('checkout.status') : 'Status'}: ${sub.status}</p>
          <p>${window.i18nUtils ? window.i18nUtils.translate('checkout.startDate') : 'Start Date'}: ${new Date(sub.start_date).toLocaleDateString()}</p>
          ${sub.end_date ? `<p>${window.i18nUtils ? window.i18nUtils.translate('checkout.endDate') : 'End Date'}: ${new Date(sub.end_date).toLocaleDateString()}</p>` : ''}
        `;
        subscriptionListDiv.appendChild(subDiv);
      });
    } else {
      // If no active subscriptions from /all, check /stats for has_subscription
      const statsResponse = await fetchWithAuth(`${API_BASE_URL}/api/subscription/stats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const statsData = await statsResponse.json();

      if (statsResponse.ok && statsData.has_subscription) {
        // Display a generic message if has_subscription is true but no details from /all
        subscriptionListDiv.innerHTML += window.i18nUtils ? window.i18nUtils.translate('checkout.activeSubscriptionFound') : '<p>An active subscription was found.</p>';
      } else {
        subscriptionListDiv.innerHTML += window.i18nUtils ? window.i18nUtils.translate('checkout.noActiveSubscriptions') : '<p>No active subscriptions found.</p>';
      }
    }

    // Fetch and display subscription stats
    try {
      const statsResponse = await fetchWithAuth(`${API_BASE_URL}/api/subscription/stats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const statsData = await statsResponse.json();

      if (statsResponse.ok) {
        const statsDiv = document.createElement('div');
        statsDiv.className = 'subscription-stats-item';
        statsDiv.innerHTML = `
          <h4>${window.i18nUtils ? window.i18nUtils.translate('checkout.usageStats') : 'Usage Statistics'}:</h4>
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-value">${statsData.total_comments_generated || 0}</span>
              <span class="stat-label">${window.i18nUtils ? window.i18nUtils.translate('checkout.commentsGenerated') : 'Comments Generated'}</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${statsData.total_posts_analyzed || 0}</span>
              <span class="stat-label">${window.i18nUtils ? window.i18nUtils.translate('checkout.postsAnalyzed') : 'Posts Analyzed'}</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${statsData.total_hiring_managers_targeted || 0}</span>
              <span class="stat-label">${window.i18nUtils ? window.i18nUtils.translate('checkout.hiringManagersTargeted') : 'Hiring Managers Targeted'}</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${statsData.total_messages_sent || 0}</span>
              <span class="stat-label">${window.i18nUtils ? window.i18nUtils.translate('checkout.messagesSent') : 'Messages Sent'}</span>
            </div>
          </div>
        `;
        subscriptionStatsContainer.appendChild(statsDiv);
      } else {
        subscriptionStatsContainer.innerHTML += `<p>Error fetching usage stats: ${statsData.detail || statsData.message || 'Unknown error'}</p>`;
      }
    } catch (statsError) {
      console.error(`Error fetching usage stats:`, statsError);
      subscriptionStatsContainer.innerHTML += `<p>Error fetching usage stats: ${statsError.message || 'Network error'}</p>`;
    }

    buyNewSubscriptionButton.disabled = false; // Enable button after all fetches

  } catch (error) {
    console.error('Fetch subscriptions error:', error);
    subscriptionListDiv.innerHTML = window.i18nUtils ? window.i18nUtils.translate('checkout.fetchSubscriptionsError') : '<p>Error loading subscriptions. Please try again.</p>';
    buyNewSubscriptionButton.disabled = false;
  }
}

function toggleForm(formType) {
  console.log('toggleForm called with:', formType);
  const createAccountForm = document.getElementById('create-account-form');
  const loginForm = document.getElementById('login-form');
  const subscriptionsDisplay = document.getElementById('subscriptions-display');
  const createAccountButton = document.getElementById('show-create-account');
  const loginButton = document.getElementById('show-login');
  const mainCheckoutButton = document.getElementById('create-account-button'); // This button is used for both create and buy new
  const paymentSection = document.querySelector('.payment-section');
  const checkoutForm = document.querySelector('.checkout-form'); // Define checkoutForm here

  // Hide all forms and deactivate buttons
  createAccountForm.style.display = 'none';
  loginForm.style.display = 'none';
  subscriptionsDisplay.style.display = 'none';
  createAccountButton.classList.remove('active');
  loginButton.classList.remove('active');

  if (formType === 'create-account') {
    createAccountForm.style.display = 'block';
    createAccountButton.classList.add('active');
    mainCheckoutButton.style.display = 'block';
    paymentSection.style.display = 'block'; // Show payment section
    checkoutForm.classList.remove('subscriptions-active'); // Remove class

    updateButtonText(mainCheckoutButton); // Ensure platform text is updated
  } else if (formType === 'login') {
    loginForm.style.display = 'block';
    loginButton.classList.add('active');
    mainCheckoutButton.style.display = 'none'; // Hide main button for login form
    paymentSection.style.display = 'block'; // Show payment section
    checkoutForm.classList.remove('subscriptions-active'); // Remove class
  } else if (formType === 'subscriptions') {
    subscriptionsDisplay.style.display = 'block';
    createAccountButton.classList.remove('active'); // Ensure neither toggle is active
    loginButton.classList.remove('active');
    mainCheckoutButton.style.display = 'block'; // Keep buy new subscription button visible
    paymentSection.style.display = 'none'; // Hide payment section when subscriptions are shown
    checkoutForm.classList.add('subscriptions-active'); // Add class
    updateButtonText(mainCheckoutButton); // Ensure platform text is updated
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
  const platformName = platform === 'macos' ? 'macOS' : (platform === 'linux' ? window.i18nUtils.translate('checkout.linux') : 'Windows');

  let baseText = '';
  if (buttonElement.id === 'create-account-button') {
    baseText = window.i18nUtils ? window.i18nUtils.translate('checkout.createAccount') : 'Create Account & Subscribe - $20/month';
  } else if (buttonElement.id === 'buy-new-subscription-button') {
    baseText = window.i18nUtils ? window.i18nUtils.translate('checkout.buyNewSubscription') : 'Buy New Subscription - $20/month';
  }

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
