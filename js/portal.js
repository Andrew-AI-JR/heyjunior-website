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
}

// Store subscriptions globally for history modal
let allSubscriptions = [];

function displaySubscriptions(subscriptions) {
    // Store subscriptions for history modal
    allSubscriptions = subscriptions || [];
    
    if (!subscriptions || subscriptions.length === 0) {
        document.getElementById('no-subscription').style.display = 'block';
        document.getElementById('subscription-details').style.display = 'none';
        // Hide view all link if no subscriptions
        const viewAllLink = document.getElementById('view-all-subscriptions-link');
        if (viewAllLink) {
            viewAllLink.style.display = 'none';
        }
        return;
    }
    
    // Show view all link if there are subscriptions (always show to view full history)
    const viewAllLink = document.getElementById('view-all-subscriptions-link');
    if (viewAllLink) {
        viewAllLink.style.display = 'inline';
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
    
    // Display subscription details - API returns 'plan' field (required)
    const planName = activeSub.plan || activeSub.plan_name || 'Standard';
    const tier = activeSub.tier ? ` (${activeSub.tier})` : '';
    document.getElementById('subscription-plan').textContent = planName + tier;
    
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
    if (!stats) {
        document.getElementById('no-stats').style.display = 'block';
        document.getElementById('stats-grid').innerHTML = '';
        return;
    }
    
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = '';
    
    let hasAnyStats = false;
    
    // Display usage stats - per API docs, usage endpoint returns daily_usage and monthly_usage
    if (stats.usage) {
        // SubscriptionUsageResponse: { daily_usage: integer, monthly_usage: integer }
        const usageStats = [
            { 
                label: 'Usage Today', 
                value: stats.usage.daily_usage || stats.usage.today || 0 
            },
            { 
                label: 'Usage This Month', 
                value: stats.usage.monthly_usage || stats.usage.this_month || 0 
            }
        ];
        
        // Also show total_comments_generated if available from stats endpoint
        if (stats.total_comments_generated) {
            usageStats.push({
                label: 'Total Comments Generated',
                value: parseInt(stats.total_comments_generated) || 0
            });
        }
        
        usageStats.forEach(stat => {
            if (stat.value > 0 || stat.label === 'Usage Today') {
                const statCard = createStatCard(stat.label, stat.value);
                statsGrid.appendChild(statCard);
                hasAnyStats = true;
            }
        });
    }
    
    // Display remaining - calculate from limits and usage if not provided
    // Per API docs, remaining might come from stats.remaining (JSON string) or we calculate it
    let remainingDaily = 0;
    let remainingMonthly = 0;
    
    if (stats.remaining) {
        remainingDaily = stats.remaining.daily || stats.remaining.today || 0;
        remainingMonthly = stats.remaining.monthly || 0;
    } else if (stats.limits && stats.usage) {
        // Calculate remaining from limits and usage
        const dailyLimit = parseInt(stats.limits.daily_limit) || 0;
        const monthlyLimit = parseInt(stats.limits.monthly_limit) || 0;
        const dailyUsage = stats.usage.daily_usage || 0;
        const monthlyUsage = stats.usage.monthly_usage || 0;
        
        remainingDaily = Math.max(0, dailyLimit - dailyUsage);
        remainingMonthly = Math.max(0, monthlyLimit - monthlyUsage);
    }
    
    // Always show remaining if we have limits (even if 0, so users know their status)
    if (stats.limits && !stats.limits.is_unlimited) {
        const remainingStats = [
            { label: 'Remaining Today', value: remainingDaily },
            { label: 'Remaining This Month', value: remainingMonthly }
        ];
        
        remainingStats.forEach(stat => {
            const statCard = createStatCard(stat.label, stat.value);
            statsGrid.appendChild(statCard);
            hasAnyStats = true;
        });
    }
    
    // Display limits if available - per API docs: SubscriptionLimitsResponse
    if (stats.limits) {
        // SubscriptionLimitsResponse: { daily_limit, monthly_limit, is_warmup, is_unlimited, tier, warmup_week, warmup_percentage }
        const dailyLimit = stats.limits.daily_limit;
        const monthlyLimit = stats.limits.monthly_limit;
        const isUnlimited = stats.limits.is_unlimited;
        const isWarmup = stats.limits.is_warmup;
        const tier = stats.limits.tier;
        
        const limitStats = [];
        
        if (isUnlimited) {
            limitStats.push({ label: 'Daily Limit', value: 'Unlimited' });
            limitStats.push({ label: 'Monthly Limit', value: 'Unlimited' });
        } else {
            if (dailyLimit) {
                limitStats.push({ label: 'Daily Limit', value: dailyLimit });
            }
            if (monthlyLimit) {
                limitStats.push({ label: 'Monthly Limit', value: monthlyLimit });
            }
        }
        
        if (isWarmup && stats.limits.warmup_week) {
            limitStats.push({ 
                label: 'Warmup Status', 
                value: `Week ${stats.limits.warmup_week}${stats.limits.warmup_percentage ? ` (${stats.limits.warmup_percentage}%)` : ''}` 
            });
        }
        
        if (tier) {
            limitStats.push({ label: 'Tier', value: tier });
        }
        
        limitStats.forEach(stat => {
            const statCard = createStatCard(stat.label, stat.value);
            statsGrid.appendChild(statCard);
            hasAnyStats = true;
        });
    }
    
    // Display analytics data if available - per API docs: UsageAnalyticsResponse
    if (stats.analytics) {
        // UsageAnalyticsResponse: { period_days, start_date, end_date, total_usage, average_daily, peak_day, daily_breakdown, content_type_breakdown, active_days }
        const analyticsStats = [
            { label: 'Total Usage (Period)', value: stats.analytics.total_usage || 0 },
            { label: 'Average Daily', value: stats.analytics.average_daily ? stats.analytics.average_daily.toFixed(1) : 0 },
            { label: 'Active Days', value: stats.analytics.active_days || 0 }
        ];
        
        if (stats.analytics.peak_day && stats.analytics.peak_day.date) {
            const peakDate = new Date(stats.analytics.peak_day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            analyticsStats.push({ 
                label: 'Peak Day', 
                value: `${stats.analytics.peak_day.usage || 0} (${peakDate})` 
            });
        }
        
        analyticsStats.forEach(stat => {
            if (stat.value > 0 || stat.label === 'Total Usage (Period)') {
                const statCard = createStatCard(stat.label, stat.value);
                statsGrid.appendChild(statCard);
                hasAnyStats = true;
            }
        });
    }
    
    // If no stats available, show message
    if (!hasAnyStats) {
        document.getElementById('no-stats').style.display = 'block';
        document.getElementById('stats-grid').innerHTML = '';
    } else {
        document.getElementById('no-stats').style.display = 'none';
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
        downloadsList.style.display = 'block';
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
                filename: `Junior-${version}-arm64.dmg`,
                size: '615 MB'
            }
        ];
        
        // Filter out downloads that don't have URLs
        const availableDownloads = downloadOptions.filter(d => d.url);
        
        if (availableDownloads.length === 0) {
            downloadsList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No downloads available at this time. Please check back later.</p>';
            return;
        }
        
        // Create download cards
        availableDownloads.forEach(download => {
            const card = document.createElement('div');
            card.className = 'download-option';
            card.style.cssText = 'padding: 20px; margin-bottom: 20px; background: white; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);';
            
            const hashDisplay = download.hash 
                ? `<div style="margin-top: 12px; padding: 10px; background: #f9fafb; border-radius: 6px; font-family: monospace; font-size: 0.85rem; word-break: break-all;">
                    <strong style="color: #374151; display: block; margin-bottom: 4px;">SHA256:</strong>
                    <code style="color: #059669;">${download.hash}</code>
                   </div>`
                : '';
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <h3 style="margin: 0 0 6px 0; color: #1f2937; font-size: 1.1rem;">${download.title}</h3>
                        <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">${download.description}</p>
                    </div>
                </div>
                <div style="margin: 12px 0; color: #6b7280; font-size: 0.85rem;">
                    <strong>File:</strong> ${download.filename}<br>
                    <strong>Size:</strong> ${download.size}
                </div>
                ${hashDisplay}
                <button 
                   class="download-button-portal" 
                   style="margin-top: 16px;"
                   data-download-url="${download.url}"
                   data-download-platform="${download.title}">
                    Download ${download.title.includes('Windows') ? 'for Windows' : download.title.includes('Intel') ? 'for macOS Intel' : 'for macOS (Apple Silicon)'}
                </button>
            `;
            
            downloadsList.appendChild(card);
        });
        
        // Add version info
        const versionInfo = document.createElement('div');
        versionInfo.style.cssText = 'margin-top: 20px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb; text-align: center;';
        versionInfo.innerHTML = `<p style="margin: 0; color: #1e40af; font-size: 0.9rem;"><strong>Latest Version:</strong> v${version}</p>`;
        downloadsList.appendChild(versionInfo);
        
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
            // According to API docs: plan, status, tier are required fields
            const planName = sub.plan || sub.plan_name || 'Unknown';
            const tier = sub.tier || '';
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
            
            // Build plan display with tier if available
            let planDisplay = escapeHtml(planName);
            if (tier) {
                planDisplay += ` <span style="color: #6b7280; font-size: 0.85em;">(${escapeHtml(tier)})</span>`;
            }
            
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
