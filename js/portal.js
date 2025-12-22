/* portal.js - User Portal Dashboard */

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? window.location.origin.replace(/:\d+$/, ':8001') 
    : 'https://api.heyjunior.ai';

// Stripe Price IDs for different plans
const STRIPE_PRICE_IDS = {
  'standard': 'price_1RJMCrRxE6F23RwQEnHUwvFq', // Standard plan ($29.99/month, 50 comments/day)
  'pro': 'price_1SX1LrRxE6F23RwQgWgIV1NK'       // Pro plan ($49.99/month, 80 comments/day)
};

// Global token management
let currentUserToken = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Portal page loaded');
    
    // Restore button states in case user came back from checkout
    restoreButtonStates();
    
    // Check if user is authenticated
    const token = sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
    
    // Show/hide logout button based on auth state
    const logoutLink = document.getElementById('logout-link');
    const logoutSeparator = document.getElementById('logout-separator');
    if (logoutLink) {
        if (token) {
            // User is logged in - show logout button and setup handler
            logoutLink.style.display = 'block';
            if (logoutSeparator) logoutSeparator.style.display = 'inline';
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        } else {
            // User is not logged in - hide logout button and separator
            logoutLink.style.display = 'none';
            if (logoutSeparator) logoutSeparator.style.display = 'none';
        }
    }
    
    if (!token) {
        console.log('No authentication token found, showing login form...');
        showLoginForm();
        return;
    }
    
    currentUserToken = token;
    
    // Load all dashboard data
    await loadDashboardData();
});

async function fetchWithAuth(url, options = {}) {
    let token = currentUserToken || sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
    let headers = { ...options.headers };
    
    if (!token) {
        throw new Error('No authentication token available');
    }
    
    headers['Authorization'] = `Bearer ${token}`;
    headers['Content-Type'] = 'application/json';
    
    let response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
        console.warn('Access token expired. Redirecting to login...');
        sessionStorage.clear();
        window.location.href = 'checkout.html?redirect=portal';
        return response;
    }
    
    return response;
}

async function loadDashboardData() {
    try {
        showLoading();
        
        // Load all data in parallel
        const [userData, subscriptions, stats, referral, comments] = await Promise.all([
            loadUserData(),
            loadSubscriptions(),
            loadStats(),
            loadReferralInfo(),
            loadMyComments(1, 20) // Load only the first 20 comments
        ]);
        
        // Display the data
        displayUserData(userData);
        displaySubscriptions(subscriptions);
        displayStats(stats);
        displayReferralInfo(referral);
        displayComments(comments);
        
        hideLoading();
        showDashboard();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError(error.message || 'Failed to load dashboard data');
    }
}

async function loadUserData() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/me`);
        if (!response || !response.ok) {
            throw new Error('Failed to load user data');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

async function loadSubscriptions() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/subscription/all?status=all`);
        if (!response || !response.ok) {
            throw new Error('Failed to load subscriptions');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        return [];
    }
}

async function loadStats() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/subscription/stats`);
        if (!response || !response.ok) {
            throw new Error('Failed to load stats');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading stats:', error);
        return null;
    }
}

async function loadReferralInfo() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/me/referral`);
        if (!response || !response.ok) {
            throw new Error('Failed to load referral info');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading referral info:', error);
        return { referral_code: null, referrals_count: 0 };
    }
}

async function loadMyComments(page = 1, size = 20) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/comments/my-comments?page=${page}&size=${size}`);
        if (!response || !response.ok) {
            throw new Error('Failed to load comments');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading comments:', error);
        return { comments: [], total: 0, page: 1, size: 20, total_pages: 0 };
    }
}

function displayUserData(userData) {
    if (!userData) return;
    
    // Display email
    const email = userData.email || sessionStorage.getItem('userEmail') || 'N/A';
    document.getElementById('user-email').textContent = email;
    
    // Display account status
    const status = userData.is_active !== false ? 'Active' : 'Inactive';
    document.getElementById('account-status').textContent = status;
    
    // Display member since
    if (userData.created_at) {
        const createdDate = new Date(userData.created_at);
        document.getElementById('member-since').textContent = createdDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else {
        document.getElementById('member-since').textContent = 'N/A';
    }
}

function displaySubscriptions(subscriptions) {
    if (!subscriptions || subscriptions.length === 0) {
        document.getElementById('no-subscription').style.display = 'block';
        document.getElementById('subscription-details').style.display = 'none';
        return;
    }
    
    // Find active subscription (prioritize active, trialing, or past_due)
    const activeSub = subscriptions.find(sub => 
        ['active', 'trialing', 'past_due'].includes(sub.status?.toLowerCase())
    ) || subscriptions[0];
    
    if (!activeSub) {
        document.getElementById('no-subscription').style.display = 'block';
        document.getElementById('subscription-details').style.display = 'none';
        return;
    }
    
    document.getElementById('no-subscription').style.display = 'none';
    document.getElementById('subscription-details').style.display = 'block';
    
    // Display subscription details
    const planName = activeSub.plan_name || activeSub.price_id || 'Standard';
    document.getElementById('subscription-plan').textContent = planName;
    
    const status = activeSub.status || 'unknown';
    const statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    document.getElementById('subscription-status').textContent = statusText;
    document.getElementById('sub-status').textContent = statusText;
    
    // Set badge color based on status
    const badge = document.getElementById('subscription-badge');
    const isTrialing = status.toLowerCase() === 'trialing';
    
    if (['active', 'trialing'].includes(status.toLowerCase())) {
        badge.textContent = isTrialing ? 'Trial' : 'Active';
        badge.className = 'subscription-badge active';
    } else if (status.toLowerCase() === 'past_due') {
        badge.textContent = 'Past Due';
        badge.className = 'subscription-badge warning';
    } else {
        badge.textContent = statusText;
        badge.className = 'subscription-badge inactive';
    }
    
    // Show trial message if on trial
    const trialMessage = document.getElementById('trial-message');
    if (trialMessage) {
        if (isTrialing) {
            trialMessage.style.display = 'block';
        } else {
            trialMessage.style.display = 'none';
        }
    }
    
    // Display period dates
    // Dates come from API as ISO strings or Unix timestamps
    if (activeSub.current_period_start && activeSub.current_period_end) {
        // Parse date - could be ISO string or Unix timestamp
        let startDate, endDate;
        
        if (typeof activeSub.current_period_start === 'string') {
            // ISO string format
            startDate = new Date(activeSub.current_period_start);
        } else if (typeof activeSub.current_period_start === 'number') {
            // Unix timestamp (seconds) - convert to milliseconds
            startDate = new Date(activeSub.current_period_start * 1000);
        } else {
            startDate = new Date(activeSub.current_period_start);
        }
        
        if (typeof activeSub.current_period_end === 'string') {
            // ISO string format
            endDate = new Date(activeSub.current_period_end);
        } else if (typeof activeSub.current_period_end === 'number') {
            // Unix timestamp (seconds) - convert to milliseconds
            endDate = new Date(activeSub.current_period_end * 1000);
        } else {
            endDate = new Date(activeSub.current_period_end);
        }
        
        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.error('Invalid date values:', activeSub.current_period_start, activeSub.current_period_end);
            document.getElementById('sub-period').textContent = 'N/A';
            document.getElementById('sub-next-billing').textContent = 'N/A';
        } else {
            document.getElementById('sub-period').textContent = 
                `${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
            document.getElementById('sub-next-billing').textContent = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    } else {
        document.getElementById('sub-period').textContent = 'N/A';
        document.getElementById('sub-next-billing').textContent = 'N/A';
    }
}

function displayStats(stats) {
    if (!stats || !stats.has_subscription) {
        document.getElementById('no-stats').style.display = 'block';
        document.getElementById('stats-grid').innerHTML = '';
        return;
    }
    
    document.getElementById('no-stats').style.display = 'none';
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = '';
    
    // Display usage stats if available
    if (stats.usage) {
        const usageStats = [
            { label: 'Comments Generated', value: stats.usage.comments_generated || stats.usage.comments || 0 },
            { label: 'Posts Analyzed', value: stats.usage.posts_analyzed || stats.usage.posts || 0 },
            { label: 'Connections Made', value: stats.usage.connections || 0 },
            { label: 'Messages Sent', value: stats.usage.messages_sent || stats.usage.messages || 0 }
        ];
        
        usageStats.forEach(stat => {
            if (stat.value > 0 || stat.label === 'Comments Generated') {
                const statCard = createStatCard(stat.label, stat.value);
                statsGrid.appendChild(statCard);
            }
        });
    }
    
    // Display limits if available
    if (stats.limits) {
        const limitStats = [
            { label: 'Daily Limit', value: stats.limits.daily_limit || stats.limits.daily || 'N/A' },
            { label: 'Monthly Limit', value: stats.limits.monthly_limit || stats.limits.monthly || 'N/A' }
        ];
        
        limitStats.forEach(stat => {
            if (stat.value !== 'N/A') {
                const statCard = createStatCard(stat.label, stat.value);
                statsGrid.appendChild(statCard);
            }
        });
    }
    
    // Display remaining if available
    if (stats.remaining) {
        const remainingStats = [
            { label: 'Remaining Today', value: stats.remaining.daily || stats.remaining.today || 0 },
            { label: 'Remaining This Month', value: stats.remaining.monthly || 0 }
        ];
        
        remainingStats.forEach(stat => {
            if (stat.value > 0 || stat.label === 'Remaining Today') {
                const statCard = createStatCard(stat.label, stat.value);
                statsGrid.appendChild(statCard);
            }
        });
    }
    
    // If no stats available, show message
    if (statsGrid.children.length === 0) {
        document.getElementById('no-stats').style.display = 'block';
    }
}

function createStatCard(label, value) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
        <div class="stat-value">${formatStatValue(value)}</div>
        <div class="stat-label">${label}</div>
    `;
    return card;
}

function formatStatValue(value) {
    if (typeof value === 'number') {
        return value.toLocaleString();
    }
    return value;
}

function displayComments(commentsData) {
    if (!commentsData || !commentsData.comments || commentsData.comments.length === 0) {
        document.getElementById('no-comments').style.display = 'block';
        document.getElementById('comments-list').innerHTML = '';
        return;
    }
    
    document.getElementById('no-comments').style.display = 'none';
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '';
    
    // Display total count
    document.getElementById('comments-total').textContent = commentsData.total || 0;
    
    // Limit to only the last 20 comments (most recent first)
    const commentsToShow = commentsData.comments.slice(0, 20);
    
    // Display each comment (limited to 20)
    commentsToShow.forEach(comment => {
        const commentCard = createCommentCard(comment);
        commentsList.appendChild(commentCard);
    });
    
    // Hide pagination info since we're only showing the last 20
    const paginationInfo = document.getElementById('comments-pagination');
    if (paginationInfo) {
        paginationInfo.style.display = 'none';
    }
}

function createCommentCard(comment) {
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.style.cssText = 'padding: 15px; margin-bottom: 15px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;';
    
    // Format date
    let dateStr = 'N/A';
    if (comment.comment_date) {
        const date = new Date(comment.comment_date);
        dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } else if (comment.created_at) {
        const date = new Date(comment.created_at);
        dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    // Status badge color
    let statusColor = '#6b7280';
    if (comment.status === 'posted') statusColor = '#10b981';
    else if (comment.status === 'pending') statusColor = '#f59e0b';
    else if (comment.status === 'failed') statusColor = '#ef4444';
    
    // Determine which LinkedIn URL to use (prefer posted_linkedin_url, fallback to source_linkedin_url)
    const linkedinUrl = comment.posted_linkedin_url || comment.source_linkedin_url;
    const linkText = comment.posted_linkedin_url ? 'View on LinkedIn' : (comment.source_linkedin_url ? 'View Source' : '');
    
    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div>
                <span style="padding: 4px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">${comment.status || 'unknown'}</span>
                <span style="margin-left: 10px; color: #6b7280; font-size: 0.85rem;">${dateStr}</span>
            </div>
            <span style="color: #6b7280; font-size: 0.85rem;">${comment.content_type || 'N/A'}</span>
        </div>
        <div style="margin-bottom: 10px;">
            <p style="margin: 0; color: #1f2937; line-height: 1.5; word-wrap: break-word;">${escapeHtml(comment.generated_text || 'No text available')}</p>
        </div>
        ${linkedinUrl ? `<div style="margin-top: 8px;"><a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-size: 0.85rem; text-decoration: none; font-weight: 500;">${linkText} →</a></div>` : ''}
    `;
    
    return card;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function displayReferralInfo(referral) {
    if (!referral) return;
    
    // Display referral count
    const count = referral.referrals_count || 0;
    document.getElementById('referral-count').textContent = count;
    
    // Generate and display referral link
    const referralCode = referral.referral_code;
    if (referralCode) {
        const baseUrl = window.location.origin;
        const referralLink = `${baseUrl}?ref=${referralCode}`;
        document.getElementById('referral-link-input').value = referralLink;
    } else {
        document.getElementById('referral-link-input').value = 'Loading...';
    }
}

function copyReferralLink() {
    const input = document.getElementById('referral-link-input');
    const button = document.getElementById('copy-referral-btn');
    const buttonText = document.getElementById('copy-btn-text');
    
    if (!input || input.value === 'Loading...') {
        return;
    }
    
    input.select();
    input.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        navigator.clipboard.writeText(input.value).then(() => {
            buttonText.textContent = 'Copied!';
            button.classList.add('copied');
            
            setTimeout(() => {
                buttonText.textContent = 'Copy';
                button.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            document.execCommand('copy');
            buttonText.textContent = 'Copied!';
            setTimeout(() => {
                buttonText.textContent = 'Copy';
            }, 2000);
        });
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

async function handleLogin(event) {
    if (event) {
        event.preventDefault();
    }
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const loginButton = document.getElementById('login-button');
    const loginButtonText = document.getElementById('login-button-text');
    const loginError = document.getElementById('login-error');
    
    // Clear previous errors
    loginError.style.display = 'none';
    loginButton.disabled = true;
    loginButtonText.textContent = 'Logging in...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                username: email,  // API expects 'username' field (email as username)
                password: password
            })
        });
        
        // Check content type before parsing
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // If not JSON, read as text
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error(text || 'Login failed. Please check your credentials.');
        }
        
        if (!response.ok) {
            // Handle validation errors (422) - detail is an array
            let errorMessage = 'Login failed. Please check your credentials.';
            if (data.detail) {
                if (Array.isArray(data.detail)) {
                    // Validation errors - format them nicely
                    errorMessage = data.detail.map(err => err.msg || err.message || 'Validation error').join('. ');
                } else if (typeof data.detail === 'string') {
                    errorMessage = data.detail;
                } else {
                    errorMessage = data.detail.message || JSON.stringify(data.detail);
                }
            } else if (data.message) {
                errorMessage = data.message;
            }
            throw new Error(errorMessage);
        }
        
        // Store tokens
        if (data.access_token) {
            sessionStorage.setItem('userToken', data.access_token);
            currentUserToken = data.access_token;
        }
        if (data.refresh_token) {
            sessionStorage.setItem('refreshToken', data.refresh_token);
        }
        if (data.user_id) {
            sessionStorage.setItem('userId', data.user_id);
        }
        if (email) {
            sessionStorage.setItem('userEmail', email);
        }
        
        // Hide login form and load dashboard
        hideLoginForm();
        
        // Show logout button after successful login
        const logoutLink = document.getElementById('logout-link');
        const logoutSeparator = document.getElementById('logout-separator');
        if (logoutLink) {
            logoutLink.style.display = 'block';
            if (logoutSeparator) logoutSeparator.style.display = 'inline';
        }
        
        await loadDashboardData();
        
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please check your credentials and try again.';
        
        if (error.message) {
            errorMessage = error.message;
        } else if (error instanceof SyntaxError) {
            errorMessage = 'Server returned an invalid response. Please check that the API is running correctly.';
        }
        
        loginError.textContent = errorMessage;
        loginError.style.display = 'block';
        loginButton.disabled = false;
        loginButtonText.textContent = 'Login';
    }
    return false;
}

// Make handleLogin globally accessible
window.handleLogin = handleLogin;

function showLoginForm() {
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'none';
    // Hide portal header when showing login
    const portalHeader = document.querySelector('.portal-header');
    if (portalHeader) {
        portalHeader.style.display = 'none';
    }
}

function hideLoginForm() {
    document.getElementById('login-section').style.display = 'none';
    // Show portal header when hiding login
    const portalHeader = document.querySelector('.portal-header');
    if (portalHeader) {
        portalHeader.style.display = 'block';
    }
}

function handleLogout(event) {
    if (event) {
        event.preventDefault();
    }
    
    // Clear all session and auth data
    sessionStorage.clear();
    // Keep referral code (user might want to use it after logging back in)
    // Only clear auth-related localStorage items
    localStorage.removeItem('partnerPaymentLink');
    // Clear current token
    currentUserToken = null;
    
    // Redirect to portal (will show login form)
    window.location.href = 'portal.html';
    
    return false;
}

// Make handleLogout globally accessible
window.handleLogout = handleLogout;

function showLoading() {
    document.getElementById('loading-state').style.display = 'block';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading-state').style.display = 'none';
}

function showDashboard() {
    document.getElementById('dashboard-content').style.display = 'block';
}

function showError(message) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
    document.getElementById('error-message').textContent = message || 'An error occurred while loading your account information.';
}

function restoreButtonStates() {
    // Restore all subscription buttons to their original state
    const buttons = [
        document.getElementById('subscribe-standard-btn'),
        document.getElementById('subscribe-pro-btn'),
        document.getElementById('trial-subscribe-standard-btn'),
        document.getElementById('trial-subscribe-pro-btn')
    ];
    
    buttons.forEach(btn => {
        if (btn) {
            btn.disabled = false;
            // Restore original text if stored, otherwise use default
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
            } else {
                // Set default text based on button ID
                if (btn.id.includes('standard')) {
                    btn.textContent = 'Subscribe to Standard';
                } else if (btn.id.includes('pro')) {
                    btn.textContent = 'Subscribe to Pro';
                }
            }
        }
    });
    
    // Clear any error messages
    const errorElements = [
        document.getElementById('subscribe-error'),
        document.getElementById('trial-subscribe-error')
    ];
    
    errorElements.forEach(el => {
        if (el) {
            el.style.display = 'none';
        }
    });
}

async function createCheckoutSession(planType) {
    // planType should be 'standard' or 'pro'
    if (!planType || !['standard', 'pro'].includes(planType)) {
        console.error('Invalid plan type:', planType);
        return;
    }
    
    // Find all buttons and error elements
    const standardButtons = [
        document.getElementById('subscribe-standard-btn'),
        document.getElementById('trial-subscribe-standard-btn')
    ].filter(btn => btn !== null);
    
    const proButtons = [
        document.getElementById('subscribe-pro-btn'),
        document.getElementById('trial-subscribe-pro-btn')
    ].filter(btn => btn !== null);
    
    const errorElements = [
        document.getElementById('subscribe-error'),
        document.getElementById('trial-subscribe-error')
    ].filter(el => el !== null);
    
    // Determine which button was clicked
    const activeButtons = planType === 'standard' ? standardButtons : proButtons;
    
    // Get the Stripe price ID for the selected plan
    const priceId = STRIPE_PRICE_IDS[planType];
    console.log('Creating checkout for plan:', planType, 'with price_id:', priceId);
    
    if (!priceId) {
        const errorMsg = `Invalid plan selected: ${planType}. Please try again.`;
        errorElements.forEach(el => {
            el.textContent = errorMsg;
            el.style.display = 'block';
        });
        return;
    }
    
    // Clear previous errors
    errorElements.forEach(el => el.style.display = 'none');
    
    // Disable only the clicked button and show loading
    activeButtons.forEach(btn => {
        if (btn) {
            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = 'Creating checkout session...';
            btn.dataset.originalText = originalText;
        }
    });
    
    try {
        const token = currentUserToken || sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
        if (!token) {
            throw new Error('You must be logged in to subscribe. Please log in again.');
        }
        
        // Get coupon code if any was applied
        const appliedCoupon = sessionStorage.getItem('appliedCoupon');
        
        const requestBody = {
            price_id: priceId,
            success_url: `${window.location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/portal.html`
        };
        
        console.log('Creating checkout session with:', requestBody);
        
        // Add coupon code if available
        if (appliedCoupon) {
            requestBody.coupon_code = appliedCoupon;
        }
        
        const response = await fetchWithAuth(`${API_BASE_URL}/api/payments/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response || !response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to create checkout session' }));
            throw new Error(errorData.detail || errorData.message || 'Failed to create checkout session');
        }
        
        const data = await response.json();
        
        if (data.checkout_url) {
            // Redirect to Stripe checkout
            window.location.href = data.checkout_url;
        } else {
            throw new Error('No checkout URL received from server');
        }
        
    } catch (error) {
        console.error('Error creating checkout session:', error);
        const errorMsg = error.message || 'Failed to create checkout session. Please try again.';
        errorElements.forEach(el => {
            el.textContent = errorMsg;
            el.style.display = 'block';
        });
        
        // Re-enable only the clicked button
        activeButtons.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = btn.dataset.originalText || (planType === 'standard' ? 'Subscribe to Standard' : 'Subscribe to Pro');
            }
        });
    }
}

// Make function globally accessible
window.createCheckoutSession = createCheckoutSession;

async function openManageSubscription() {
    const manageButton = document.getElementById('manage-subscription-btn');
    const originalText = manageButton ? manageButton.textContent : 'Manage Subscription';
    
    try {
        const token = currentUserToken || sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
        if (!token) {
            alert('You must be logged in to manage your subscription.');
            window.location.href = 'portal.html';
            return;
        }
        
        if (manageButton) {
            manageButton.disabled = true;
            manageButton.textContent = 'Loading...';
        }
        
        // Get return URL (current page URL)
        const returnUrl = `${window.location.origin}${window.location.pathname}`;
        
        const response = await fetchWithAuth(`${API_BASE_URL}/api/payments/create-portal-session`, {
            method: 'POST',
            body: JSON.stringify({
                return_url: returnUrl
            })
        });
        
        if (!response || !response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to create portal session' }));
            throw new Error(errorData.detail || errorData.message || 'Failed to open subscription management');
        }
        
        const data = await response.json();
        
        // API returns "url" field, not "return_url"
        if (data.url) {
            // Redirect to Stripe Customer Portal
            window.location.href = data.url;
        } else {
            throw new Error('No portal URL received from server');
        }
        
    } catch (error) {
        console.error('Error opening subscription management:', error);
        alert(error.message || 'Failed to open subscription management. Please try again.');
        if (manageButton) {
            manageButton.disabled = false;
            manageButton.textContent = originalText;
        }
    }
}

// Make function globally accessible
window.openManageSubscription = openManageSubscription;
