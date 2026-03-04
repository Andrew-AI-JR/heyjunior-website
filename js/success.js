/* success.js - Integrated Payment Verification and Account Setup */

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? window.location.origin.replace(/:\d+$/, ':8000') : 'https://api.heyjunior.ai';

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
  const userId = urlParams.get('user_id') || sessionStorage.getItem('userId');

  console.log('Payment verification data:', { sessionId, userId });

  if (!sessionId) {
    console.error('Missing session_id in URL');
    showError('Missing payment verification data. Please check your email for download instructions or contact support.');
    return;
  }

  sessionStorage.setItem('stripeSessionId', sessionId);

  // Verify payment first, then start download. Timeout after 10s so user is never stuck.
  const VERIFY_TIMEOUT_MS = 10000;
  let verified = false;

  try {
    const verifyPromise = verifyPaymentAndSetupAccount(sessionId, userId ? parseInt(userId) : null);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Verification timed out')), VERIFY_TIMEOUT_MS)
    );
    verified = await Promise.race([verifyPromise, timeoutPromise]);
  } catch (error) {
    console.warn('Payment verification did not complete in time or failed:', error.message);
  }

  if (verified) {
    console.log('Payment verified - starting auto-download countdown');
    startDownloadCountdown();
  } else {
    console.warn('Verification incomplete - showing manual download option');
    showSuccess();
    showManualDownloadFallback();
  }
});

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

async function verifyPaymentAndSetupAccount(sessionId, userId) {
  console.log('Verifying payment success...', { sessionId, userId });

  const userToken = sessionStorage.getItem('userToken');
  const headers = { 'Content-Type': 'application/json' };
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  }

  const body = { session_id: sessionId };
  if (userId != null) {
    body.user_id = userId;
  }

  const response = await fetch(`${API_BASE_URL}/api/payments/verify-success`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  const data = await response.json();
  console.log('Payment verification response:', data);

  if (!response.ok) {
    throw new Error(data.detail || 'Payment verification failed');
  }

  if (data.success && data.subscription_active) {
    if (data.access_token) {
      sessionStorage.setItem('accessToken', data.access_token);
    }
    if (data.email) {
      sessionStorage.setItem('userEmail', data.email);
    }
    sessionStorage.setItem('subscriptionActive', 'true');
    console.log('Payment verified successfully');
    return true;
  }

  throw new Error('Payment was not successful or subscription is not active');
}

async function loadAccountDetails(accessToken) {
  try {
    console.log('Loading account details...');

    const response = await fetch(`${API_BASE_URL}/api/payments/get-account-access`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Account details:', data);

    if (response.ok && data.has_subscription) {
      // Update UI with account details
      updateAccountDetails(data);

      // Show API access section if user has subscription
      if (data.api_key) {
        showApiAccess(data.api_key);
      }
    }

  } catch (error) {
    console.error('Error loading account details:', error);
    // Don't throw here - payment was successful, this is just additional info
  }
}

function showSuccess() {
  // Hide loading state
  document.getElementById('loading-state').style.display = 'none';

  // Show success state
  document.getElementById('success-state').style.display = 'block';
  document.getElementById('support-section').style.display = 'block';

  console.log('Success state displayed');
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
  // Hide loading state
  document.getElementById('loading-state').style.display = 'none';

  // Show error state
  document.getElementById('error-state').style.display = 'block';
  document.getElementById('error-support-section').style.display = 'block';

  // Update error message if needed
  const errorHeader = document.querySelector('#error-state h1');
  if (errorHeader && message) {
    errorHeader.textContent = 'Payment Verification Failed';
  }

  console.log('Error state displayed:', message);
}

function updateAccountDetails(accountData) {
  // Update subscription details
  if (accountData.tier) {
    const statusElement = document.getElementById('subscription-status');
    statusElement.textContent = `Active (${accountData.tier})`;
  }

  if (accountData.expires_at) {
    const expiryInfo = document.createElement('p');
    const expiryDate = new Date(accountData.expires_at).toLocaleDateString();
    expiryInfo.innerHTML = `Next billing date: <strong>${expiryDate}</strong>`;
    document.getElementById('account-details').appendChild(expiryInfo);
  }

  console.log('Account details updated');
}

function showApiAccess(apiKey) {
  const apiSection = document.getElementById('api-access-section');
  const apiKeyDisplay = document.getElementById('api-key-display');

  if (apiSection && apiKeyDisplay) {
    // Mask the API key for security (show first 8 and last 4 characters)
    const maskedKey = apiKey.length > 12 ?
      apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4) :
      apiKey;

    apiKeyDisplay.textContent = maskedKey;
    apiKeyDisplay.setAttribute('data-full-key', apiKey);

    // Add copy functionality
    const copyButton = document.getElementById('copy-api-key');
    if (copyButton) {
      copyButton.addEventListener('click', () => copyApiKey(apiKey));
    }

    apiSection.style.display = 'block';
    console.log('API access section displayed');
  }
}

function copyApiKey(apiKey) {
  navigator.clipboard.writeText(apiKey).then(() => {
    const button = document.getElementById('copy-api-key');
    const originalText = button.textContent;
    button.textContent = '✅ Copied!';

    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);

    console.log('API key copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy API key:', err);
    alert('Failed to copy API key. Please select and copy manually.');
  });
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
                    <li>Download the installer (Junior.Setup.1.0.40.exe)</li>
                    <li>Right-click the downloaded file and select "Run as administrator"</li>
                    <li>If Windows shows a security warning, click "More info" then "Run anyway"</li>
                    <li>Follow the installation wizard</li>
                    <li>Launch Junior from your desktop or Start menu</li>
                    <li>Enter your API key when prompted</li>
                </ol>
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
                </ol>
                <p style="margin-top: 15px; padding: 12px; background: #dbeafe; border-radius: 8px; color: #1e40af;">
                    <strong>💡 Pro tip:</strong> You only need to do the right-click method once. After that, Junior opens normally.
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
