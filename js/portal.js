/* portal.js - User Portal Dashboard */

const API_BASE_URL = window.getApiBaseUrl();

// Stripe Price IDs for different plans
const STRIPE_PRICE_IDS = window.JUNIOR_PRICING ? window.JUNIOR_PRICING.STRIPE_PRICE_IDS : {
  'basic': 'price_1TcWzqRxE6F23RwQ7FnKpQyU',
  'starter': 'price_1TcX0nRxE6F23RwQpZxnoTRv',
  'standard': 'price_1RJMCrRxE6F23RwQEnHUwvFq',
  'pro': 'price_1SX1LrRxE6F23RwQgWgIV1NK'
};

// Global token management
let currentUserToken = null;

// Check authentication on page load
const PORTAL_PLAN_INPUT_NAME = 'portal-plan';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Portal page loaded');
    initPortalPlanSelection();
    applyPortalPlanFromUrl();

    // Auto-auth from email link (e.g. winback email)
    const urlParams = new URLSearchParams(window.location.search);
    const emailToken = urlParams.get('token');
    if (emailToken) {
        sessionStorage.setItem('userToken', emailToken);
        urlParams.delete('token');
        const cleanUrl = urlParams.toString()
            ? `${window.location.pathname}?${urlParams}`
            : window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }

    // Auto-apply coupon from URL parameter (e.g. ?coupon=JUNIOR50)
    const couponParam = urlParams.get('coupon');
    if (couponParam) {
        const code = couponParam.trim().toUpperCase();
        sessionStorage.setItem('appliedCoupon', code);
        const promoBanner = document.getElementById('promo-banner');
        const promoCodeValue = document.getElementById('promo-code-value');
        if (promoBanner && promoCodeValue) {
            promoCodeValue.textContent = code;
            promoBanner.style.display = 'block';
        }
        console.log('Auto-applied coupon from URL:', code);
    }
    
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
    return window.juniorFetchWithAuth(url, {
        ...options,
        auth401Redirect: 'register.html?src=portal',
    });
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
        displaySubscriptions(subscriptions, userData);
        displayStats(stats);
        displayReferralInfo(referral);
        displayComments(comments);
        
        // Load download links (uses release manager, doesn't need API)
        await loadDownloads();
        
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
        const data = await response.json();
        // Handle both array response and wrapped response (SubscriptionListResponse)
        return Array.isArray(data) ? data : (data.subscriptions || []);
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        return [];
    }
}

async function loadStats() {
    try {
        // Fetch from multiple endpoints in parallel
        const [usageResponse, limitsResponse, statsResponse, analyticsResponse] = await Promise.allSettled([
            fetchWithAuth(`${API_BASE_URL}/api/subscription/usage`),
            fetchWithAuth(`${API_BASE_URL}/api/subscription/limits`),
            fetchWithAuth(`${API_BASE_URL}/api/subscription/stats`),
            fetchWithAuth(`${API_BASE_URL}/api/subscription/analytics`)
        ]);
        
        // Helper function to safely extract JSON from response
        const safeGetJson = async (responseResult) => {
            if (responseResult.status === 'fulfilled' && responseResult.value && responseResult.value.ok) {
                try {
                    return await responseResult.value.json();
                } catch (e) {
                    console.warn('Error parsing JSON response:', e);
                    return null;
                }
            }
            return null;
        };
        
        // Extract data from successful responses
        const [usage, limits, stats, analytics] = await Promise.all([
            safeGetJson(usageResponse),
            safeGetJson(limitsResponse),
            safeGetJson(statsResponse),
            safeGetJson(analyticsResponse)
        ]);
        
        // Parse stats response - API returns some fields as JSON strings per SubscriptionStatsResponse
        let parsedStats = {};
        if (stats) {
            parsedStats = { ...stats };
            // Parse string fields that might be JSON
            if (typeof stats.usage === 'string') {
                try {
                    parsedStats.usage = JSON.parse(stats.usage);
                } catch (e) {
                    console.warn('Failed to parse stats.usage as JSON:', e);
                }
            }
            if (typeof stats.limits === 'string') {
                try {
                    parsedStats.limits = JSON.parse(stats.limits);
                } catch (e) {
                    console.warn('Failed to parse stats.limits as JSON:', e);
                }
            }
            if (typeof stats.remaining === 'string') {
                try {
                    parsedStats.remaining = JSON.parse(stats.remaining);
                } catch (e) {
                    console.warn('Failed to parse stats.remaining as JSON:', e);
                }
            }
            if (typeof stats.progress === 'string') {
                try {
                    parsedStats.progress = JSON.parse(stats.progress);
                } catch (e) {
                    console.warn('Failed to parse stats.progress as JSON:', e);
                }
            }
        }
        
        // Combine all data into a single stats object
        // Per API docs:
        // - usage endpoint returns: { daily_usage, monthly_usage }
        // - limits endpoint returns: { daily_limit, monthly_limit, is_warmup, is_unlimited, tier, warmup_week, warmup_percentage }
        // - stats endpoint returns: { has_subscription, subscription, limits, usage, remaining, progress, recent_activity, total_comments_generated, message }
        // - analytics endpoint returns: { period_days, start_date, end_date, total_usage, average_daily, peak_day, daily_breakdown, content_type_breakdown, active_days }
        const combinedStats = {
            has_subscription: parsedStats?.has_subscription ?? true,
            usage: {},
            limits: limits || parsedStats?.limits || {},
            remaining: parsedStats?.remaining || {},
            analytics: analytics || {},
            total_comments_generated: parsedStats?.total_comments_generated
        };
        
        // Merge usage data - usage endpoint only has daily_usage and monthly_usage
        if (usage) {
            // SubscriptionUsageResponse: { daily_usage: integer, monthly_usage: integer }
            combinedStats.usage = {
                daily_usage: usage.daily_usage || 0,
                monthly_usage: usage.monthly_usage || 0
            };
        }
        
        // Merge stats.usage if available (might have more detailed info)
        if (parsedStats?.usage) {
            combinedStats.usage = {
                ...combinedStats.usage,
                ...parsedStats.usage
            };
        }
        
        // Merge limits data - SubscriptionLimitsResponse structure
        if (limits) {
            // SubscriptionLimitsResponse: { daily_limit, monthly_limit, is_warmup, is_unlimited, tier, warmup_week, warmup_percentage }
            combinedStats.limits = {
                ...combinedStats.limits,
                ...limits,
                daily_limit: limits.daily_limit,
                monthly_limit: limits.monthly_limit,
                is_warmup: limits.is_warmup,
                is_unlimited: limits.is_unlimited,
                tier: limits.tier,
                warmup_week: limits.warmup_week,
                warmup_percentage: limits.warmup_percentage
            };
        }
        
        // Calculate remaining from limits and usage
        if (combinedStats.limits && combinedStats.usage) {
            const dailyLimit = parseInt(combinedStats.limits.daily_limit) || 0;
            const monthlyLimit = parseInt(combinedStats.limits.monthly_limit) || 0;
            const dailyUsage = combinedStats.usage.daily_usage || 0;
            const monthlyUsage = combinedStats.usage.monthly_usage || 0;
            
            combinedStats.remaining = {
                ...combinedStats.remaining,
                daily: Math.max(0, dailyLimit - dailyUsage),
                monthly: Math.max(0, monthlyLimit - monthlyUsage)
            };
        }
        
        // Merge remaining from stats if available
        if (parsedStats?.remaining) {
            combinedStats.remaining = {
                ...combinedStats.remaining,
                ...parsedStats.remaining
            };
        }
        
        // Log for debugging
        console.log('Combined stats:', combinedStats);
        
        return combinedStats;
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

    const resellerNav = document.getElementById('reseller-nav-item');
    if (resellerNav) {
        resellerNav.style.display = userData.is_reseller ? 'list-item' : 'none';
    }

    const resellerRow = document.getElementById('reseller-status-row');
    const resellerVal = document.getElementById('reseller-status-value');
    if (userData.is_reseller && resellerRow && resellerVal) {
        resellerRow.style.display = 'flex';
        const rs = userData.reseller_status;
        resellerVal.textContent = rs ? String(rs).replace(/_/g, ' ') : '—';
    } else if (resellerRow) {
        resellerRow.style.display = 'none';
    }
}

// Store subscriptions globally for history modal
let allSubscriptions = [];

function isActiveSubscriptionStatus(status) {
    return ['active', 'trialing', 'past_due'].includes(String(status || '').toLowerCase());
}

function findActiveSubscription(subscriptions) {
    if (!subscriptions || !subscriptions.length) {
        return null;
    }
    return subscriptions.find(sub => isActiveSubscriptionStatus(sub.status)) || null;
}

function userHadPriorSubscription(subscriptions) {
    if (!subscriptions || !subscriptions.length) {
        return false;
    }
    return subscriptions.some(sub => {
        const status = String(sub.status || '').toLowerCase();
        return ['canceled', 'cancelled', 'unpaid', 'incomplete_expired'].includes(status)
            || (status === 'incomplete' && sub.stripe_subscription_id);
    });
}

function configureNoSubscriptionPanel(subscriptions, userData) {
    const titleEl = document.getElementById('no-subscription-title');
    const descEl = document.getElementById('no-subscription-desc');
    const trialHint = document.getElementById('no-subscription-trial-hint');
    const historyLink = document.getElementById('no-sub-history-link');
    const hadPrior = userHadPriorSubscription(subscriptions);

    if (titleEl) {
        titleEl.textContent = hadPrior ? 'Subscribe to Junior' : 'Complete your signup';
    }
    if (descEl) {
        descEl.textContent = hadPrior
            ? 'You do not have an active subscription. Choose a plan below, then pay securely in Stripe to restore access.'
            : 'Your account is ready. Choose a plan below, then add your payment method in Stripe to activate Junior.';
    }
    if (trialHint) {
        trialHint.style.display = hadPrior ? 'none' : 'block';
    }
    if (historyLink) {
        historyLink.style.display = subscriptions && subscriptions.length ? 'inline' : 'none';
    }
}

function initPortalPlanSelection() {
    function updatePlanVisualState(name) {
        const selectedValue = document.querySelector(`input[name="${name}"]:checked`)?.value;
        document.querySelectorAll(`input[name="${name}"]`).forEach(function (input) {
            const option = input.closest('.plan-selector-option');
            if (option) {
                if (input.checked && input.value === selectedValue) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            }
        });
    }

    document.querySelectorAll(`input[name="${PORTAL_PLAN_INPUT_NAME}"]`).forEach(function (input) {
        input.addEventListener('change', function () {
            updatePlanVisualState(PORTAL_PLAN_INPUT_NAME);
        });
    });
    updatePlanVisualState(PORTAL_PLAN_INPUT_NAME);
}

function getSelectedPortalPlan() {
    const selected = document.querySelector(`input[name="${PORTAL_PLAN_INPUT_NAME}"]:checked`);
    if (!selected) {
        return null;
    }
    const planKey = selected.value;
    const priceId = STRIPE_PRICE_IDS[planKey];
    if (!priceId) {
        return null;
    }
    return { planKey: planKey, priceId: priceId };
}

function applyPortalPlanFromUrl() {
    const plan = new URLSearchParams(window.location.search).get('plan');
    if (!plan || !STRIPE_PRICE_IDS[plan]) {
        return;
    }
    const radio = document.getElementById('portal-plan-' + plan);
    if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
    }
}

function displaySubscriptions(subscriptions, userData) {
    // Store subscriptions for history modal
    allSubscriptions = subscriptions || [];

    const activeSub = findActiveSubscription(subscriptions);
    const noSubEl = document.getElementById('no-subscription');
    const detailsEl = document.getElementById('subscription-details');
    const viewAllLink = document.getElementById('view-all-subscriptions-link');

    if (!activeSub) {
        if (noSubEl) {
            noSubEl.style.display = 'block';
        }
        if (detailsEl) {
            detailsEl.style.display = 'none';
        }
        configureNoSubscriptionPanel(subscriptions, userData);
        if (viewAllLink) {
            viewAllLink.style.display = 'none';
        }
        return;
    }

    if (noSubEl) {
        noSubEl.style.display = 'none';
    }
    if (detailsEl) {
        detailsEl.style.display = 'block';
    }
    if (viewAllLink) {
        viewAllLink.style.display = 'inline';
    }
    
    const rawPlan = activeSub.plan || activeSub.plan_name || 'Standard';
    const planName = window.JUNIOR_PRICING ? window.JUNIOR_PRICING.mapLegacyPlan(rawPlan) : rawPlan;
    document.getElementById('subscription-plan').textContent = planName;
    
    const status = activeSub.status || 'unknown';
    const statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    document.getElementById('subscription-status').textContent = statusText;
    document.getElementById('sub-status').textContent = statusText;
    
    // Set badge color based on status
    const badge = document.getElementById('subscription-badge');
    const isTrialing = status.toLowerCase() === 'trialing';
    
    // Handle all valid Stripe subscription statuses per API docs:
    // incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid
    const statusLower = status.toLowerCase();
    if (statusLower === 'active') {
        badge.textContent = 'Active';
        badge.className = 'subscription-badge active';
    } else if (statusLower === 'trialing') {
        badge.textContent = 'Trial';
        badge.className = 'subscription-badge active';
    } else if (statusLower === 'past_due') {
        badge.textContent = 'Past Due';
        badge.className = 'subscription-badge warning';
    } else if (statusLower === 'canceled' || statusLower === 'cancelled') {
        badge.textContent = 'Canceled';
        badge.className = 'subscription-badge inactive';
    } else if (statusLower === 'unpaid') {
        badge.textContent = 'Unpaid';
        badge.className = 'subscription-badge inactive';
    } else if (statusLower === 'incomplete' || statusLower === 'incomplete_expired') {
        badge.textContent = statusLower === 'incomplete' ? 'Incomplete' : 'Expired';
        badge.className = 'subscription-badge inactive';
    } else {
        badge.textContent = statusText;
        badge.className = 'subscription-badge inactive';
    }
    
    const trialMessage = document.getElementById('trial-message');
    const trialMessageText = document.getElementById('trial-message-text');
    if (trialMessage) {
        if (isTrialing) {
            trialMessage.style.display = 'block';
            if (trialMessageText && activeSub.current_period_end) {
                const endDate = new Date(activeSub.current_period_end);
                if (!isNaN(endDate.getTime())) {
                    trialMessageText.textContent =
                        'Your free trial is active until ' + endDate.toLocaleDateString() +
                        '. Billing starts automatically after the trial unless you cancel in Manage Subscription.';
                }
            }
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
    if (!stats) {
        document.getElementById('no-stats').style.display = 'block';
        document.getElementById('stats-grid').innerHTML = '';
        return;
    }
    
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = '';
    
    let hasAnyStats = false;
    
    // Get usage and limits
    const dailyUsage = stats.usage?.daily_usage || 0;
    const monthlyUsage = stats.usage?.monthly_usage || 0;
    const dailyLimit = stats.limits?.daily_limit ? parseInt(stats.limits.daily_limit) : 0;
    const monthlyLimit = stats.limits?.monthly_limit ? parseInt(stats.limits.monthly_limit) : 0;
    const isUnlimited = stats.limits?.is_unlimited;
    
    // Calculate remaining
    const remainingDaily = isUnlimited ? null : Math.max(0, dailyLimit - dailyUsage);
    const remainingMonthly = isUnlimited ? null : Math.max(0, monthlyLimit - monthlyUsage);
    
    // Calculate progress percentages
    const dailyProgress = dailyLimit > 0 ? (dailyUsage / dailyLimit) * 100 : 0;
    const monthlyProgress = monthlyLimit > 0 ? (monthlyUsage / monthlyLimit) * 100 : 0;
    
    // Show total comments generated as summary card if available
    if (stats.total_comments_generated) {
        const totalComments = parseInt(stats.total_comments_generated) || 0;
        if (totalComments > 0) {
            const summaryCard = createStatCard('Total Comments Generated', totalComments, { type: 'total' });
            summaryCard.className += ' summary-card';
            statsGrid.appendChild(summaryCard);
            hasAnyStats = true;
        }
    }
    
    // Daily & Monthly Usage Section - Combined, cleaner layout
    if (stats.limits && !isUnlimited && (dailyLimit > 0 || monthlyLimit > 0)) {
        const usageGroup = document.createElement('div');
        usageGroup.className = 'stats-group';
        
        // Daily Usage with progress
        if (dailyLimit > 0) {
            const dailyUsageCard = createStatCard('Used Today', dailyUsage, {
                type: 'usage',
                progress: dailyProgress,
                maxValue: dailyLimit
            });
            usageGroup.appendChild(dailyUsageCard);
        }
        
        // Monthly Usage with progress
        if (monthlyLimit > 0) {
            const monthlyUsageCard = createStatCard('Used This Month', monthlyUsage, {
                type: 'usage',
                progress: monthlyProgress,
                maxValue: monthlyLimit
            });
            usageGroup.appendChild(monthlyUsageCard);
        }
        
        statsGrid.appendChild(usageGroup);
        hasAnyStats = true;
    }
    
    // Only show warmup status if in warmup period (not tier or unlimited info)
    if (stats.limits && stats.limits.is_warmup && stats.limits.warmup_week) {
        const warmupGroup = document.createElement('div');
        warmupGroup.className = 'stats-group';
        warmupGroup.innerHTML = '<div class="stats-group-title">Warmup Status</div>';
        
        const warmupText = `Week ${stats.limits.warmup_week}${stats.limits.warmup_percentage ? ` (${stats.limits.warmup_percentage}%)` : ''}`;
        const warmupCard = createStatCard('Current Warmup', warmupText, { type: 'limit' });
        warmupGroup.appendChild(warmupCard);
        
        statsGrid.appendChild(warmupGroup);
        hasAnyStats = true;
    }
    
    // Analytics Section (if available)
    if (stats.analytics && stats.analytics.total_usage > 0) {
        const analyticsGroup = document.createElement('div');
        analyticsGroup.className = 'stats-group';
        analyticsGroup.innerHTML = '<div class="stats-group-title">Analytics</div>';
        
        const analyticsCards = [
            { label: 'Average Daily', value: stats.analytics.average_daily ? stats.analytics.average_daily.toFixed(1) : 0 },
            { label: 'Active Days', value: stats.analytics.active_days || 0 }
        ];
        
        if (stats.analytics.peak_day && stats.analytics.peak_day.date) {
            const peakDate = new Date(stats.analytics.peak_day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            analyticsCards.push({ 
                label: 'Peak Day', 
                value: `${stats.analytics.peak_day.usage || 0} (${peakDate})` 
            });
        }
        
        analyticsCards.forEach(stat => {
            const card = createStatCard(stat.label, stat.value, { type: 'total' });
            analyticsGroup.appendChild(card);
        });
        
        statsGrid.appendChild(analyticsGroup);
        hasAnyStats = true;
    }
    
    // If no stats available, show message
    if (!hasAnyStats) {
        document.getElementById('no-stats').style.display = 'block';
        document.getElementById('stats-grid').innerHTML = '';
    } else {
        document.getElementById('no-stats').style.display = 'none';
    }
}

function createStatCard(label, value, options = {}) {
    const card = document.createElement('div');
    const cardType = options.type || 'default';
    const progress = options.progress; // 0-100 percentage
    const maxValue = options.maxValue;
    const showProgress = progress !== undefined;
    
    let progressBar = '';
    let progressText = '';
    
    if (showProgress && maxValue) {
        const percentage = Math.min(100, Math.max(0, progress));
        let progressClass = '';
        if (percentage >= 90) progressClass = 'danger';
        else if (percentage >= 75) progressClass = 'warning';
        
        progressBar = `
            <div class="stat-progress">
                <div class="stat-progress-bar ${progressClass}" style="width: ${percentage}%"></div>
            </div>
            <div class="stat-progress-text">
                <span>${formatStatValue(value)} / ${formatStatValue(maxValue)}</span>
                <span>${percentage.toFixed(0)}%</span>
            </div>
        `;
    }
    
    card.className = `stat-card ${cardType}-card`;
    card.innerHTML = `
        <div class="stat-card-header">
            <div class="stat-label">${label}</div>
        </div>
        <div class="stat-value">${formatStatValue(value)}</div>
        ${progressBar}
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
    
    // Determine which LinkedIn URL to use - prefer posted_linkedin_url, fallback to source_linkedin_url
    // Handle null, undefined, empty string, and "null" string values
    const postedUrlRaw = comment.posted_linkedin_url;
    const sourceUrlRaw = comment.source_linkedin_url;
    
    const postedUrl = postedUrlRaw && 
                     postedUrlRaw !== 'null' && 
                     typeof postedUrlRaw === 'string' &&
                     postedUrlRaw.trim() !== '' 
                     ? postedUrlRaw.trim() 
                     : null;
    
    const sourceUrl = sourceUrlRaw && 
                     sourceUrlRaw !== 'null' && 
                     typeof sourceUrlRaw === 'string' &&
                     sourceUrlRaw.trim() !== '' 
                     ? sourceUrlRaw.trim() 
                     : null;
    
    const linkedinUrl = postedUrl || sourceUrl;
    const linkText = postedUrl ? 'View on LinkedIn' : (sourceUrl ? 'View Source' : 'View on LinkedIn');
    
    // Build link HTML - show link if URL exists
    let linkHtml = '';
    if (linkedinUrl) {
        linkHtml = `<div style="margin-top: 8px;"><a href="${escapeHtml(linkedinUrl)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-size: 0.85rem; text-decoration: none; font-weight: 500;">${linkText} →</a></div>`;
    }
    
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
        ${linkHtml}
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

    const referredRow = document.getElementById('referred-by-row');
    const referredVal = document.getElementById('referred-by-value');
    if (referredRow && referredVal) {
        if (referral.referred_by) {
            referredRow.style.display = 'flex';
            referredVal.textContent = referral.referred_by;
        } else {
            referredRow.style.display = 'none';
        }
    }

    const resellerBanner = document.getElementById('reseller-banner');
    if (resellerBanner) {
        resellerBanner.style.display = referral.is_reseller ? 'block' : 'none';
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
        document.getElementById('subscribe-btn'),
        document.getElementById('trial-subscribe-btn')
    ];
    
    buttons.forEach(btn => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Subscribe';
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

async function startPortalCheckout(planType) {
    const btn = document.getElementById('portal-checkout-btn');
    const errEl = document.getElementById('subscribe-error');
    const originalText = btn ? btn.textContent : 'Continue to secure checkout';

    let planKey = planType;
    let priceId = planType ? STRIPE_PRICE_IDS[planType] : null;
    if (!priceId) {
        const selection = getSelectedPortalPlan();
        if (selection) {
            planKey = selection.planKey;
            priceId = selection.priceId;
        }
    }

    if (!priceId) {
        if (errEl) {
            errEl.textContent = 'Please select a subscription plan.';
            errEl.style.display = 'block';
        }
        return;
    }

    if (errEl) {
        errEl.style.display = 'none';
    }
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Loading checkout...';
    }

    try {
        const token = currentUserToken || sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
        if (!token) {
            window.location.href = 'register.html?src=portal-subscribe';
            return;
        }

        const appliedCoupon = sessionStorage.getItem('appliedCoupon');
        const requestBody = {
            price_id: priceId,
            success_url: `${window.location.origin}/success.html`,
            cancel_url: `${window.location.origin}/portal.html`
        };
        if (appliedCoupon) {
            requestBody.coupon_code = appliedCoupon;
        }

        const refCode = window.getReferralCode ? window.getReferralCode() : localStorage.getItem('referralCode');
        if (refCode) {
            requestBody.referral_code = refCode.toUpperCase();
        }

        console.log('Portal checkout for plan:', planKey, requestBody);

        const response = await fetchWithAuth(`${API_BASE_URL}/api/payments/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response || !response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to start checkout' }));
            throw new Error(errorData.detail || errorData.message || 'Failed to start checkout');
        }

        const data = await response.json();
        if (data.checkout_url) {
            window.location.href = data.checkout_url;
        } else {
            throw new Error('No checkout URL received');
        }
    } catch (error) {
        console.error('Portal checkout error:', error);
        if (errEl) {
            errEl.textContent = error.message || 'Failed to open checkout. Please try again.';
            errEl.style.display = 'block';
        }
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

async function createCheckoutSession(planType) {
    return startPortalCheckout(planType);
}

function createCheckoutSessionFromPortal() {
    return startPortalCheckout();
}

window.createCheckoutSession = createCheckoutSession;
window.createCheckoutSessionFromPortal = createCheckoutSessionFromPortal;
window.startPortalCheckout = startPortalCheckout;
window.resumeSignupCheckout = startPortalCheckout;

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

// SHA256 hashes for v1.0.40 (and future versions)
const DOWNLOAD_HASHES = {
    '1.0.40': {
        'windows': '8da1ef96358ba61be31ce31d6430d3029cb01ee4bd780fc882f152b1ac8c2799',
        'macos_intel': '2cf898f4feca13053a20cbca82115988d709f7beebb3df2d38f55e346b1664e9',
        'macos_arm': '5bbdd3e72b1b8df32815d4aac17176b55ae86700b95bdd649ef10419261b705e'
    }
};

async function loadDownloads() {
    try {
        const downloadsList = document.getElementById('downloads-list');
        const downloadsLoading = document.querySelector('.downloads-loading');
        
        if (!downloadsList || !downloadsLoading) {
            console.warn('Download section elements not found');
            return;
        }
        
        // Check if release manager is available
        if (!window.juniorReleaseManager) {
            console.warn('Release manager not available');
            downloadsLoading.innerHTML = '<p style="color: #ef4444;">Unable to load download links. Please refresh the page.</p>';
            return;
        }
        
        // Fetch latest release info
        const release = await window.juniorReleaseManager.getLatestRelease();
        const version = release.version || '1.0.40';
        const downloads = release.downloads || {};
        
        // Get hashes for this version (fallback to v1.0.40 if not found)
        const versionHashes = DOWNLOAD_HASHES[version] || DOWNLOAD_HASHES['1.0.40'];
        
        // Hide loading, show downloads
        downloadsLoading.style.display = 'none';
        downloadsList.style.display = 'flex';
        downloadsList.innerHTML = '';
        
        // Create download cards
        const downloadOptions = [
            {
                id: 'windows',
                title: '🖥️ Windows',
                description: 'For Windows 10 or later',
                url: downloads.windows,
                hash: versionHashes?.windows,
                filename: `Junior.Setup.${version}.exe`,
                size: '718 MB'
            },
            {
                id: 'macos_intel',
                title: '🍎 macOS (Intel)',
                description: 'For Intel-based Macs (macOS 10.14+)',
                url: downloads.macos_intel,
                hash: versionHashes?.macos_intel,
                filename: `Junior-${version}-x64.dmg`,
                size: '619 MB'
            },
            {
                id: 'macos_arm',
                title: '🍎 macOS (Apple Silicon)',
                description: 'For Apple Silicon Macs (M1/M2/M3, macOS 10.14+)',
                url: downloads.macos_arm,
                hash: versionHashes?.macos_arm,
                filename: (downloads.macos_arm || '').endsWith('.zip')
                    ? `Junior-${version}-arm64-mac.zip`
                    : `Junior-${version}-arm64.dmg`,
                size: '615 MB'
            },
            {
                id: 'linux',
                title: '🐧 Linux',
                description: 'For Ubuntu/Debian (x64) — AppImage',
                url: downloads.linux_appimage || downloads.linux_deb,
                hash: versionHashes?.linux,
                filename: (downloads.linux_appimage || '').endsWith('.AppImage')
                    ? `Junior-${version}.AppImage`
                    : `junior-desktop_${version}_amd64.deb`,
                size: '~600 MB'
            }
        ];
        
        // Filter out downloads that don't have URLs
        const availableDownloads = downloadOptions.filter(d => d.url);
        
        if (availableDownloads.length === 0) {
            downloadsList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No downloads available at this time. Please check back later.</p>';
            return;
        }
        
        // Create compact download cards in a single row
        availableDownloads.forEach(download => {
            const card = document.createElement('div');
            card.className = 'download-option';
            
            // Extract icon from title (e.g., "🖥️ Windows" -> "🖥️")
            const iconMatch = download.title.match(/^(\S+)/);
            const icon = iconMatch ? iconMatch[1] : '📦';
            const titleWithoutIcon = download.title.replace(/^\S+\s+/, '');
            
            // Short button text
            let buttonText = 'Download';
            if (download.title.includes('Windows')) {
                buttonText = 'Windows';
            } else if (download.title.includes('Intel')) {
                buttonText = 'Intel';
            } else if (download.title.includes('Apple Silicon')) {
                buttonText = 'Apple Silicon';
            } else if (download.title.includes('Linux')) {
                buttonText = 'Linux';
            }
            
            card.innerHTML = `
                <div class="download-option-header">
                    <span class="download-option-icon">${icon}</span>
                    <h3 class="download-option-title">${titleWithoutIcon}</h3>
                </div>
                <p class="download-option-description">${download.description}</p>
                <div class="download-option-info">${download.size}</div>
                <div class="download-option-button-container">
                    <button 
                       class="download-button-portal" 
                       data-download-url="${download.url}"
                       data-download-platform="${download.title}">
                        ${buttonText}
                    </button>
                </div>
            `;
            
            downloadsList.appendChild(card);
        });
        
        // Add version info after the downloads list (outside flex container)
        const downloadsContent = document.getElementById('downloads-content');
        const versionInfo = document.createElement('div');
        versionInfo.className = 'downloads-version-info';
        versionInfo.innerHTML = `<p><strong>Latest Version:</strong> v${version}</p>`;
        downloadsContent.appendChild(versionInfo);
        
        // Setup download button click handlers
        setupDownloadButtons();
        
    } catch (error) {
        console.error('Error loading downloads:', error);
        const downloadsLoading = document.querySelector('.downloads-loading');
        if (downloadsLoading) {
            downloadsLoading.innerHTML = '<p style="color: #ef4444;">Failed to load download links. Please refresh the page or contact support.</p>';
        }
    }
}

// Setup download button handlers with popup
function setupDownloadButtons() {
    const downloadButtons = document.querySelectorAll('.download-button-portal');
    
    downloadButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const downloadUrl = this.getAttribute('data-download-url');
            const platform = this.getAttribute('data-download-platform');
            
            if (!downloadUrl) {
                console.error('No download URL found');
                return;
            }
            
            // Show download confirmation popup
            showDownloadPopup(downloadUrl, platform);
        });
    });
}

// Show download confirmation popup
function showDownloadPopup(downloadUrl, platform) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('download-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'download-modal';
        modal.className = 'download-modal';
        modal.innerHTML = `
            <div class="download-modal-content">
                <div class="download-modal-header">
                    <span style="font-size: 1.5rem;">📥</span>
                    <h3>Confirm Download</h3>
                </div>
                <div class="download-modal-body">
                    <p>You are about to download <strong id="modal-platform-name">${platform}</strong>.</p>
                    <p>The download will start automatically. Make sure you have a stable internet connection.</p>
                </div>
                <div class="download-modal-footer">
                    <button class="download-modal-close" onclick="closeDownloadModal()">Cancel</button>
                    <button class="download-modal-confirm" id="confirm-download-btn">Start Download</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Setup close handlers
        const closeBtn = modal.querySelector('.download-modal-close');
        const confirmBtn = modal.querySelector('#confirm-download-btn');
        
        closeBtn.addEventListener('click', closeDownloadModal);
        
        // Close on backdrop click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeDownloadModal();
            }
        });
        
        // Close on Escape key
        const escapeHandler = function(e) {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                closeDownloadModal();
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    // Update platform name
    const platformName = modal.querySelector('#modal-platform-name');
    if (platformName) {
        platformName.textContent = platform;
    }
    
    // Store download URL for confirmation
    modal.setAttribute('data-download-url', downloadUrl);
    
    // Update confirm button handler with current download URL
    const confirmBtn = modal.querySelector('#confirm-download-btn');
    if (confirmBtn) {
        // Remove old listeners by cloning
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', function() {
            const url = modal.getAttribute('data-download-url');
            if (url) {
                startDownload(url);
                closeDownloadModal();
            }
        });
    }
    
    // Show modal
    modal.classList.add('show');
}

// Close download modal
function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Start the actual download
function startDownload(downloadUrl) {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = downloadUrl.split('/').pop();
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Make functions globally accessible
window.closeDownloadModal = closeDownloadModal;

// Subscription History Modal Functions
async function showSubscriptionHistory(event) {
    if (event) {
        event.preventDefault();
    }
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('subscription-history-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'subscription-history-modal';
        modal.className = 'subscription-history-modal';
        modal.innerHTML = `
            <div class="subscription-history-modal-content">
                <div class="subscription-history-header">
                    <h3>Subscription History</h3>
                    <button class="subscription-history-close" onclick="closeSubscriptionHistory()" aria-label="Close">×</button>
                </div>
                <div id="subscription-history-content">
                    <div class="subscription-history-loading">
                        <p>Loading subscription history...</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Setup close handlers
        const closeBtn = modal.querySelector('.subscription-history-close');
        closeBtn.addEventListener('click', closeSubscriptionHistory);
        
        // Close on backdrop click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeSubscriptionHistory();
            }
        });
        
        // Close on Escape key
        const escapeHandler = function(e) {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                closeSubscriptionHistory();
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    // Show modal
    modal.classList.add('show');
    
    // Load subscription history
    await loadSubscriptionHistory();
}

async function loadSubscriptionHistory() {
    const contentDiv = document.getElementById('subscription-history-content');
    
    try {
        // Show loading state
        contentDiv.innerHTML = '<div class="subscription-history-loading"><p>Loading subscription history...</p></div>';
        
        // Fetch all subscriptions
        const response = await fetchWithAuth(`${API_BASE_URL}/api/subscription/all?status=all`);
        
        if (!response || !response.ok) {
            throw new Error('Failed to load subscription history');
        }
        
        const responseData = await response.json();
        
        // Handle both array response and wrapped response (SubscriptionListResponse)
        let subscriptions = Array.isArray(responseData) 
            ? responseData 
            : (responseData.subscriptions || []);
        
        if (!subscriptions || subscriptions.length === 0) {
            contentDiv.innerHTML = `
                <div class="subscription-history-empty">
                    <p>No subscription history found.</p>
                </div>
            `;
            return;
        }
        
        // Sort subscriptions by date (newest first)
        // API returns: start_date (required), created_at (required) - both are ISO strings
        const sortedSubscriptions = [...subscriptions].sort((a, b) => {
            const dateA = a.start_date || a.created_at || a.current_period_start || 0;
            const dateB = b.start_date || b.created_at || b.current_period_start || 0;
            return new Date(dateB) - new Date(dateA);
        });
        
        // Build table HTML
        let tableHTML = `
            <table class="subscription-history-table">
                <thead>
                    <tr>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Next Billing</th>
                        <th>Daily Limit</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        sortedSubscriptions.forEach(sub => {
            const rawPlan = sub.plan || sub.plan_name || 'Unknown';
            const planName = window.JUNIOR_PRICING ? window.JUNIOR_PRICING.mapLegacyPlan(rawPlan) : rawPlan;
            const status = (sub.status || 'unknown').toLowerCase();
            const statusText = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
            
            // Format dates - API returns ISO strings
            const formatDate = (dateValue) => {
                if (!dateValue) return 'N/A';
                let date;
                if (typeof dateValue === 'string') {
                    date = new Date(dateValue);
                } else if (typeof dateValue === 'number') {
                    // Unix timestamp (seconds) - convert to milliseconds
                    date = new Date(dateValue * 1000);
                } else {
                    date = new Date(dateValue);
                }
                if (isNaN(date.getTime())) return 'N/A';
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            };
            
            // API fields: start_date (required), current_period_start (optional), current_period_end (optional)
            const startDate = formatDate(sub.start_date || sub.current_period_start || sub.created_at);
            const endDate = formatDate(sub.current_period_end);
            const nextBilling = formatDate(sub.current_period_end);
            
            // Show cancel info if applicable
            const cancelInfo = sub.cancel_at_period_end ? ' (Cancels at period end)' : '';
            
            // Determine status badge class - API supports: incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid
            let statusBadgeClass = 'subscription-status-badge';
            if (status === 'active') {
                statusBadgeClass += ' active';
            } else if (status === 'trialing') {
                statusBadgeClass += ' trialing';
            } else if (status === 'canceled' || status === 'cancelled') {
                statusBadgeClass += ' canceled';
            } else if (status === 'past_due') {
                statusBadgeClass += ' past_due';
            } else if (status === 'incomplete' || status === 'incomplete_expired') {
                statusBadgeClass += ' incomplete';
            } else if (status === 'unpaid') {
                statusBadgeClass += ' canceled'; // Use canceled style for unpaid
            }
            
            let planDisplay = escapeHtml(planName);
            
            tableHTML += `
                <tr>
                    <td><strong>${planDisplay}</strong></td>
                    <td><span class="${statusBadgeClass}">${statusText}</span>${cancelInfo ? `<br><small style="color: #6b7280;">${cancelInfo}</small>` : ''}</td>
                    <td>${startDate}</td>
                    <td>${endDate}</td>
                    <td>${nextBilling}</td>
                    <td>${sub.current_daily_limit ? `${sub.current_daily_limit}/day` : 'N/A'}</td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        contentDiv.innerHTML = tableHTML;
        
    } catch (error) {
        console.error('Error loading subscription history:', error);
        contentDiv.innerHTML = `
            <div class="subscription-history-empty">
                <p style="color: #ef4444;">Failed to load subscription history. Please try again later.</p>
            </div>
        `;
    }
}

function closeSubscriptionHistory() {
    const modal = document.getElementById('subscription-history-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Make functions globally accessible
window.showSubscriptionHistory = showSubscriptionHistory;
window.closeSubscriptionHistory = closeSubscriptionHistory;
