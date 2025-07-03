/* success.js - Integrated Payment Verification and Account Setup */

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? window.location.origin.replace(/:\d+$/, ':8000') : 'https://api.heyjunior.ai';

// GitHub Release Configuration
const GITHUB_RELEASES = {
  owner: 'Andrew-AI-JR',
  repo: 'Desktop-Releases',
  tag: 'v1.0.0-beta',
  assets: {
    windows: 'Junior.Setup.1.0.0.exe',
    macos: 'Junior-v1.0.1.dmg',
    macos_arm: 'Junior-v1.0.1-arm64.dmg'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Success page loaded, starting payment verification...');

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  
  // Try to get user ID from URL or session storage
  const userId = urlParams.get('user_id') || sessionStorage.getItem('userId');
  
  console.log('Payment verification data:', { sessionId, userId });

  if (!sessionId) {
    console.error('Missing session_id in URL');
    showError('Missing payment verification data. Please check your email for download instructions or contact support.');
    return;
  }

  try {
    // Store session ID in session storage for retry if needed
    sessionStorage.setItem('stripeSessionId', sessionId);
    
    // Start the download flow
    startDownloadCountdown();
    
    // Verify payment in the background
    if (userId) {
      verifyPaymentAndSetupAccount(sessionId, parseInt(userId))
        .catch(error => {
          console.error('Background verification failed:', error);
          // Don't show error to user if download already started
        });
    }
  } catch (error) {
    console.error('Payment verification failed:', error);
    // Don't show error to user if download already started
  }
});

async function verifyPaymentAndSetupAccount(sessionId, userId) {
  try {
    console.log('Verifying payment success...');

    // Call the payment verification endpoint
    const userToken = sessionStorage.getItem('userToken');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/payments/verify-success`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId
      })
    });

    const data = await response.json();
    console.log('Payment verification response:', data);

    if (!response.ok) {
      throw new Error(data.detail || 'Payment verification failed');
    }

    if (data.success && data.subscription_active) {
      // Store access token for future API calls
      if (data.access_token) {
        sessionStorage.setItem('accessToken', data.access_token);
      }
      if (data.email) {
        sessionStorage.setItem('userEmail', data.email);
      }
      
      // Store subscription status
      sessionStorage.setItem('subscriptionActive', 'true');
      
      console.log('Payment verified successfully');
      return true;
    } else {
      throw new Error('Payment was not successful or subscription is not active');
    }

  } catch (error) {
    console.error('Error in payment verification:', error);
    // Don't throw here - we'll let the download continue anyway
    return false;
  }
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

function initiateDownload(platform) {
  console.log('Initiating download for platform:', platform);
  
  // Show download in progress
  const autoDownloadMessage = document.getElementById('auto-download-message');
  const countdownElement = document.getElementById('countdown');
  const progressBar = document.getElementById('download-progress');
  
  if (autoDownloadMessage) autoDownloadMessage.style.display = 'block';
  if (countdownElement) countdownElement.textContent = 'Starting download...';
  if (progressBar) progressBar.style.width = '0%';
  
  // Define download URLs
  const downloadUrls = {
    'windows': 'https://github.com/Andrew-AI-JR/Desktop-Releases/releases/download/v1.0.0-beta/Junior.Setup.1.0.0.exe',
    'macos': 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.1/Junior-v1.0.1.dmg',
    'macos_arm': 'https://github.com/Andrew-AI-JR/junior-desktop/releases/download/v1.0.1/Junior-v1.0.1-arm64.dmg'
  };
  
  const downloadUrl = downloadUrls[platform] || downloadUrls['windows'];
  console.log('Download URL:', downloadUrl);
  
  // Create a hidden link to trigger the download
  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = downloadUrl.split('/').pop();
  document.body.appendChild(downloadLink);
  
  // Simulate download progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 5;
    if (progress > 90) {
      clearInterval(progressInterval);
      // Complete the progress when the download starts
      setTimeout(() => {
        if (progressBar) progressBar.style.width = '100%';
        if (countdownElement) countdownElement.textContent = 'Download started!';
        
        // Show success message
        setTimeout(() => {
          if (countdownElement) countdownElement.textContent = 'Check your downloads folder for the installer!';
        }, 1000);
      }, 500);
    } else if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }, 100);
  
  // Start the download after a short delay to ensure UI updates
  setTimeout(() => {
    try {
      downloadLink.click();
      console.log('Download initiated');
    } catch (error) {
      console.error('Error starting download:', error);
      // Show manual download prompt if automatic download fails
      const manualDownloadPrompt = document.getElementById('manual-download-prompt');
      if (manualDownloadPrompt) {
        manualDownloadPrompt.style.display = 'block';
        manualDownloadPrompt.innerHTML = `
          <p>Unable to start download automatically. Please click the link below to download:</p>
          <a href="${downloadUrl}" class="download-now-btn" download>Download Now</a>
        `;
      }
    }
    
    // Clean up
    setTimeout(() => {
      if (document.body.contains(downloadLink)) {
        document.body.removeChild(downloadLink);
      }
    }, 10000);
  }, 500);
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
                    <li>Download the installer (Junior.Setup.1.0.0.exe)</li>
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
                <ol>
                    <li>Download the DMG file</li>
                    <li>Double-click the DMG to mount it</li>
                    <li>Drag Junior to your Applications folder</li>
                    <li>Right-click Junior in Applications and select "Open"</li>
                    <li>If macOS shows a security warning, go to System Preferences > Security & Privacy and click "Open Anyway"</li>
                    <li>Enter your API key when prompted</li>
                </ol>
                <p><strong>Note:</strong> You may need to allow Junior in your Security & Privacy settings.</p>
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
