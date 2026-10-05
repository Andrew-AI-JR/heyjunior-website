/* success.js - Integrated Payment Verification and Account Setup */

const API_BASE_URL = window.getApiBaseUrl();

// GitHub Release Configuration - DEPRECATED (now using dynamic fetching)
// This is kept as fallback only. The actual URLs are fetched from:
// https://raw.githubusercontent.com/Andrew-AI-JR/Desktop-Releases/main/latest.json
const GITHUB_RELEASES = {
  owner: 'Andrew-AI-JR',
  repo: 'Desktop-Releases',
  tag: 'v1.0.40',
  assets: {
    windows: 'Junior.Setup.1.0.40.exe',
    macos: 'Junior-1.0.40.dmg',
    macos_arm: 'Junior-1.0.40-arm64.dmg'
  }
};

// NOTE: Download URLs are now fetched dynamically via release-manager.js
// No need to update this file when releasing new versions!

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Success page loaded, starting payment verification...');

  await updateDownloadLinks();

  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  const userId = urlParams.get('user_id') || sessionStorage.getItem('userId') || localStorage.getItem('campaignUserId');

  console.log('Payment verification data:', { sessionId, userId });

  if (!sessionId) {
    console.error('Missing session_id in URL');
    showError('Missing payment verification data. Please check your email for download instructions or contact support.');
    return;
  }

  sessionStorage.setItem('stripeSessionId', sessionId);
  applyIdentityChecklist();

  const numericUserId = userId ? parseInt(userId, 10) : null;
  document.getElementById('pending-retry-btn')?.addEventListener('click', () => {
    if (window.juniorTrack) window.juniorTrack('success_manual_retry');
    runVerification(sessionId, numericUserId);
  });

  await runVerification(sessionId, numericUserId);
});

// Stripe usually confirms within seconds, but the subscription webhook can lag.
// Roughly a minute of polling with backoff, well under the API's rate limit.
const VERIFY_DELAYS_MS = [0, 2000, 3000, 5000, 8000, 10000, 12000, 15000];
const SHOW_PENDING_AFTER_ATTEMPTS = 3;

async function runVerification(sessionId, userId) {
  showState('loading');
  const result = await pollVerification(sessionId, userId);

  if (result.status === 'active') {
    if (consumePortalRedirect()) {
      window.location.href = 'portal.html';
      return;
    }
    startDownloadCountdown();
    return;
  }

  if (window.juniorTrack) {
    window.juniorTrack('success_verification_unconfirmed', { status: result.status });
  }
  if (result.status === 'incomplete') {
    showError();
  } else {
    showState('pending-timeout');
  }
}

async function pollVerification(sessionId, userId) {
  let last = { status: 'error' };
  for (let attempt = 0; attempt < VERIFY_DELAYS_MS.length; attempt++) {
    if (VERIFY_DELAYS_MS[attempt]) {
      await new Promise((resolve) => setTimeout(resolve, VERIFY_DELAYS_MS[attempt]));
    }
    last = await verifyPaymentAndSetupAccount(sessionId, userId);
    if (last.status === 'active' || last.status === 'incomplete') return last;
    if (attempt + 1 === SHOW_PENDING_AFTER_ATTEMPTS) showState('pending');
  }
  return last;
}

function consumePortalRedirect() {
  const postRedirect = localStorage.getItem('postPaymentRedirect');
  const redirectTimestamp = parseInt(localStorage.getItem('postPaymentTimestamp') || '0', 10);
  localStorage.removeItem('postPaymentRedirect');
  localStorage.removeItem('postPaymentTimestamp');
  localStorage.removeItem('campaignUserId');
  return postRedirect === 'portal' && (Date.now() - redirectTimestamp) <= 3600000;
}

function applyIdentityChecklist() {
  let identity = null;
  try {
    identity = sessionStorage.getItem('juniorPostingIdentity');
  } catch (e) {
    identity = null;
  }
  // Unknown identity: skip both identity-specific steps rather than show contradictory ones.
  document.querySelectorAll('[data-identity]').forEach((el) => {
    el.hidden = el.getAttribute('data-identity') !== identity;
  });
}

const STATE_IDS = ['loading-state', 'pending-state', 'pending-timeout-state', 'success-state', 'error-state'];

function showState(name) {
  STATE_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === name + '-state' ? 'block' : 'none';
  });
  ['support-section', 'activation-checklist', 'instructions-container'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = name === 'success' ? 'block' : 'none';
  });
  const errorSupport = document.getElementById('error-support-section');
  if (errorSupport) errorSupport.style.display = name === 'error' ? 'block' : 'none';
}

/**
 * Update all download links with latest release URLs
 */
async function updateDownloadLinks() {
  try {
    if (!window.juniorReleaseManager) {
      console.warn('[UpdateLinks] Release manager not available');
      return;
    }

    console.log('[UpdateLinks] Fetching latest release URLs...');
    const urls = await window.juniorReleaseManager.getAllDownloadUrls();
    const version = await window.juniorReleaseManager.getVersionString();

    console.log('[UpdateLinks] Latest version:', version);
    console.log('[UpdateLinks] Download URLs:', urls);

    // Update Windows link
    const windowsLink = document.getElementById('windows-download-link');
    if (windowsLink && urls.windows) {
      windowsLink.href = urls.windows;
      console.log('[UpdateLinks] ✅ Updated Windows link');
    }

    // Update macOS Intel link
    const macosIntelLink = document.getElementById('macos-intel-download-link');
    if (macosIntelLink && urls.macos_intel) {
      macosIntelLink.href = urls.macos_intel;
      console.log('[UpdateLinks] ✅ Updated macOS Intel link');
    }

    // Update macOS ARM link
    const macosArmLink = document.getElementById('macos-arm-download-link');
    if (macosArmLink && urls.macos_arm) {
      macosArmLink.href = urls.macos_arm;
      console.log('[UpdateLinks] ✅ Updated macOS ARM link');
    }

    // Update version display if element exists
    const versionInfo = document.getElementById('macos-version-info');
    if (versionInfo) {
      versionInfo.textContent = `Latest version: ${version}`;
    }

    console.log('[UpdateLinks] ✅ All download links updated successfully');
  } catch (error) {
    console.error('[UpdateLinks] Failed to update download links:', error);
    // Links will fall back to hardcoded URLs
  }
}

/**
 * One verification attempt. Resolves to { status } where status is:
 * active (trial or subscription confirmed), pending (checkout done, subscription
 * not confirmed yet), incomplete (checkout open or expired) or error.
 */
async function verifyPaymentAndSetupAccount(sessionId, userId) {
  const userToken = sessionStorage.getItem('userToken');
  const headers = { 'Content-Type': 'application/json' };
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  }

  const body = { session_id: sessionId };
  if (userId != null) {
    body.user_id = userId;
  }

  let response;
  let data = {};
  try {
    response = await fetch(`${API_BASE_URL}/api/payments/verify-success`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    data = await response.json().catch(() => ({}));
  } catch (err) {
    console.warn('[Success] verify attempt failed:', err.message);
    return { status: 'error' };
  }

  if (response.status === 400) {
    return { status: 'incomplete', message: data.detail };
  }
  if (!response.ok) {
    return { status: 'error' };
  }

  if (data.success && data.subscription_active) {
    if (window.juniorTrack) {
      window.juniorTrack('subscription_completed', {
        sessionId: sessionId
      });
    }

    if (data.access_token) {
      sessionStorage.setItem('accessToken', data.access_token);
    }
    if (data.email) {
      sessionStorage.setItem('userEmail', data.email);
    }
    sessionStorage.setItem('subscriptionActive', 'true');
    return { status: 'active' };
  }

  return { status: 'pending' };
}

function showSuccess() {
  showState('success');
}

function startDownloadCountdown() {
  let countdown = 5;
  const countdownElement = document.getElementById('countdown');
  const progressBar = document.getElementById('download-progress');
  const manualDownloadPrompt = document.getElementById('manual-download-prompt');
  const manualDownloadBtn = document.getElementById('manual-download-btn');

  // Show success UI
  showSuccess();

  // Detect user's platform
  const platform = detectUserPlatform();
  console.log('Detected platform:', platform);

  // Setup manual download button
  if (manualDownloadBtn) {
    manualDownloadBtn.addEventListener('click', () => {
      console.log('Manual download initiated');
      initiateDownload(platform);
    });
  }

  // Start countdown
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownElement) {
      countdownElement.textContent = countdown;
      const progress = 100 - (countdown * 20); // 20% per second
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
    }

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      if (document.getElementById('auto-download-message')) {
        document.getElementById('auto-download-message').style.display = 'none';
      }
      if (manualDownloadPrompt) {
        manualDownloadPrompt.style.display = 'block';
      }
      // Start download automatically
      initiateDownload(platform);
    }
  }, 1000);
}

async function initiateDownload(platform) {
  console.log('Initiating download for platform:', platform);

  const countdownElement = document.getElementById('countdown');
  const progressBar = document.getElementById('download-progress');
  const manualDownloadPrompt = document.getElementById('manual-download-prompt');

  if (countdownElement) countdownElement.textContent = 'Fetching latest version...';
  if (progressBar) progressBar.style.width = '0%';

  const downloadUrl = await resolveDownloadUrl(platform);

  if (!downloadUrl) {
    console.error('[Download] No download URL available');
    if (countdownElement) countdownElement.textContent = 'Could not fetch download link';
    showManualDownloadFallback();
    return;
  }

  if (countdownElement) countdownElement.textContent = 'Starting download...';
  console.log('[Download] Final download URL:', downloadUrl);

  if (progressBar) progressBar.style.width = '100%';

  // Use window.location.href for cross-origin GitHub URLs.
  // GitHub release assets set Content-Disposition: attachment, triggering native download.
  try {
    window.location.href = downloadUrl;
    console.log('[Download] Redirected to download URL');
  } catch (error) {
    console.error('[Download] window.location.href failed:', error);
  }

  // After 3s, show a manual CTA in case the browser blocked the redirect
  setTimeout(() => {
    if (countdownElement) countdownElement.textContent = 'Check your downloads folder for the installer!';
    if (manualDownloadPrompt) {
      manualDownloadPrompt.style.display = 'block';
      manualDownloadPrompt.innerHTML = `
        <p>If your download didn't start, click below:</p>
        <a href="${downloadUrl}" class="download-now-btn" target="_blank" rel="noopener">Download Now</a>
      `;
    }
  }, 3000);
}

/**
 * Resolve the download URL with one retry on failure.
 */
async function resolveDownloadUrl(platform) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (!window.juniorReleaseManager) {
        throw new Error('Release manager not available');
      }
      const url = await window.juniorReleaseManager.getDownloadUrl(platform);
      if (url) {
        const version = await window.juniorReleaseManager.getVersionString();
        console.log(`[Download] Resolved (attempt ${attempt}): ${version} - ${url}`);
        return url;
      }
      throw new Error('Empty download URL');
    } catch (error) {
      console.warn(`[Download] Attempt ${attempt} failed:`, error.message);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  return null;
}

/**
 * Show a prominent manual download fallback with direct links.
 */
function showManualDownloadFallback() {
  const manualDownloadPrompt = document.getElementById('manual-download-prompt');
  if (!manualDownloadPrompt) return;

  manualDownloadPrompt.style.display = 'block';

  const platform = detectUserPlatform();
  let primaryLabel = 'Download for Windows';
  if (platform === 'macos_arm') primaryLabel = 'Download for macOS (Apple Silicon)';
  else if (platform === 'macos') primaryLabel = 'Download for macOS (Intel)';

  // Try to get URL from release manager cache, otherwise link to releases page
  const releasesPageUrl = 'https://github.com/Andrew-AI-JR/Desktop-Releases/releases/latest';
  let primaryUrl = releasesPageUrl;

  if (window.juniorReleaseManager && window.juniorReleaseManager.cache) {
    const cached = window.juniorReleaseManager.cache;
    const urls = cached.downloads || {};
    if (platform === 'windows' && urls.windows) primaryUrl = urls.windows;
    else if (platform === 'macos_arm' && urls.macos_arm) primaryUrl = urls.macos_arm;
    else if (platform === 'macos' && urls.macos_intel) primaryUrl = urls.macos_intel;
  }

  manualDownloadPrompt.innerHTML = `
    <p style="margin-bottom: 12px;">Click below to download Junior:</p>
    <a href="${primaryUrl}" class="download-now-btn" target="_blank" rel="noopener">${primaryLabel}</a>
    <p style="margin-top: 12px; font-size: 0.9em; color: #6b7280;">
      Or visit <a href="${releasesPageUrl}" target="_blank" rel="noopener">all downloads</a> to choose a different platform.
    </p>
  `;
}

function showError(message) {
  showState('error');
  const detail = document.getElementById('error-detail');
  if (detail && message) {
    detail.textContent = message;
  }
}

function setupDownloadSection() {
  const downloadSection = document.getElementById('download-section');

  if (downloadSection) {
    downloadSection.style.display = 'block';

    // Get platform from session storage or detect
    const selectedPlatform = sessionStorage.getItem('selectedPlatform') || detectUserPlatform();

    // Show appropriate download option
    showDownloadOption(selectedPlatform);

    // Set up automatic download
    initiateAutomaticDownload(selectedPlatform);

    console.log('Download section setup complete for platform:', selectedPlatform);
  }
}

function detectUserPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('mac')) {
    // Detect Apple Silicon vs Intel
    const isAppleSilicon = userAgent.includes('arm') ||
      userAgent.includes('apple silicon') ||
      (navigator.platform.includes('Mac') && navigator.maxTouchPoints > 0);
    return isAppleSilicon ? 'macos_arm' : 'macos';
  } else if (userAgent.includes('win')) {
    return 'windows';
  }

  return 'windows'; // Default
}

function showDownloadOption(platform) {
  // Hide all download options first
  document.querySelectorAll('.download-option').forEach(option => {
    option.style.display = 'none';
  });

  // Show the selected platform option
  const platformOption = document.querySelector(`.download-option.${platform.replace('_', '-')}`);
  if (platformOption) {
    platformOption.style.display = 'block';
  } else {
    // Fallback to showing the base platform
    const basePlatform = platform.split('_')[0];
    const fallbackOption = document.querySelector(`.download-option.${basePlatform}`);
    if (fallbackOption) {
      fallbackOption.style.display = 'block';
    }
  }

  // Update installation instructions
  updateInstallationInstructions(platform);
}

function updateInstallationInstructions(platform) {
  const instructionsBox = document.querySelector('.instructions-box');

  if (!instructionsBox) return;

  let instructions = '';

  switch (platform) {
    case 'windows':
      instructions = `
                <h3>🖥️ Windows Installation</h3>
                <ol>
                    <li>Download the installer</li>
                    <li>Right-click the downloaded file and select "Run as administrator"</li>
                    <li>If Windows shows a security warning, click "More info" then "Run anyway"</li>
                    <li>Follow the installation wizard</li>
                    <li>Launch Junior from your desktop or Start menu</li>
                    <li>Check the <strong>"2FA"</strong> checkbox, then click <strong>"Start Automation"</strong></li>
                    <li>A Chrome window will open — log in to LinkedIn, and Junior will close the window automatically</li>
                </ol>
                <p style="margin-top: 15px; padding: 12px; background: #D8EFFB; border-radius: 8px; color: #255DB8;">
                    <strong>💡 First run only:</strong> The LinkedIn login is a one-time setup. Future runs use your saved session.
                    <a href="setup-guide.html" target="_blank" style="color: #2F6FD6; font-weight: 600; text-decoration: underline;">Full setup guide →</a>
                </p>
            `;
      break;

    case 'macos':
    case 'macos_arm':
      const chipType = platform === 'macos_arm' ? 'Apple Silicon (M1/M2/M3)' : 'Intel';
      instructions = `
                <h3>🍎 macOS Installation (${chipType})</h3>
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #92400e;">
                        <strong>⚠️ Important:</strong> macOS will block Junior on first launch because it's unsigned. 
                        <a href="mac-install-help.html" target="_blank" style="color: #b45309; font-weight: 600; text-decoration: underline;">See detailed instructions →</a>
                    </p>
                </div>
                <ol>
                    <li>Download the DMG file</li>
                    <li>Double-click the DMG to mount it</li>
                    <li>Drag Junior.app to your Applications folder</li>
                    <li><strong>Right-click</strong> Junior.app and select "Open" (not double-click!)</li>
                    <li>Click "Open" again in the security dialog</li>
                    <li>Junior will now launch successfully ✅</li>
                    <li>Check the <strong>"2FA"</strong> checkbox, then click <strong>"Start Automation"</strong></li>
                    <li>A Chrome window will open — log in to LinkedIn, and Junior will close the window automatically</li>
                </ol>
                <p style="margin-top: 15px; padding: 12px; background: #D8EFFB; border-radius: 8px; color: #255DB8;">
                    <strong>💡 First run only:</strong> The right-click and LinkedIn login are one-time steps. Future runs work normally.
                    <a href="setup-guide.html" target="_blank" style="color: #2F6FD6; font-weight: 600; text-decoration: underline;">Full setup guide →</a>
                </p>
            `;
      break;
  }

  instructionsBox.innerHTML = instructions;
}

function initiateAutomaticDownload(platform) {
  // Wait a moment for the UI to settle, then start download
  setTimeout(() => {
    const downloadButton = document.querySelector('.download-option:not([style*="display: none"]) .download-button');

    if (downloadButton) {
      console.log('Starting automatic download for platform:', platform);

      // Create temporary notification
      showDownloadNotification();

      // Trigger download by clicking the button programmatically
      downloadButton.click();
    }
  }, 2000);
}

function showDownloadNotification() {
  // Create a temporary notification that the download is starting
  const notification = document.createElement('div');
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-size: 14px;
        max-width: 300px;
    `;
  notification.innerHTML = `
        <strong>📥 Download Starting...</strong><br>
        Your Junior application download should begin shortly.
    `;

  document.body.appendChild(notification);

  // Remove notification after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Add some helpful debugging information
window.debugInfo = function () {
  console.log('Session Storage:', {
    userId: sessionStorage.getItem('userId'),
    userEmail: sessionStorage.getItem('userEmail'),
    accessToken: sessionStorage.getItem('accessToken') ? 'Present' : 'Missing',
    selectedPlatform: sessionStorage.getItem('selectedPlatform')
  });

  console.log('URL Parameters:', Object.fromEntries(new URLSearchParams(window.location.search)));
};

// Error handling for network issues
window.addEventListener('error', (event) => {
  console.error('JavaScript error on success page:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection on success page:', event.reason);
});
