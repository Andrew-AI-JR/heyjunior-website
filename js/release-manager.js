/* release-manager.js - Dynamic Release Management for Junior Desktop */

/**
 * Manages fetching and caching of the latest Junior Desktop releases
 * No more hardcoded URLs - always points to the latest version!
 */

class JuniorReleaseManager {
  constructor() {
    // Primary API endpoint (updated by CI/CD automatically)
    this.latestJsonUrl = 'https://raw.githubusercontent.com/Andrew-AI-JR/Desktop-Releases/main/latest.json';
    
    // Fallback to GitHub Releases API
    this.githubApiUrl = 'https://api.github.com/repos/Andrew-AI-JR/Desktop-Releases/releases/latest';
    
    // Cache settings
    this.cache = null;
    this.cacheTime = 5 * 60 * 1000; // 5 minutes
    this.lastFetch = 0;
    
    console.log('[ReleaseManager] Initialized with dynamic release fetching');
  }

  /**
   * Get the latest release information with caching
   * @returns {Promise<Object>} Release information
   */
  async getLatestRelease() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.cache && (now - this.lastFetch) < this.cacheTime) {
      console.log('[ReleaseManager] Using cached release data');
      return this.cache;
    }

    console.log('[ReleaseManager] Fetching latest release information...');

    try {
      // Try primary endpoint first (latest.json)
      const response = await fetch(this.latestJsonUrl);
      if (response.ok) {
        const data = await response.json();
        this.cache = data;
        this.lastFetch = now;
        console.log('[ReleaseManager] ✅ Fetched from latest.json:', data.version);
        return data;
      } else {
        console.warn('[ReleaseManager] latest.json failed, trying GitHub API fallback');
      }
    } catch (error) {
      console.warn('[ReleaseManager] Primary API failed:', error.message);
    }

    try {
      // Fallback to GitHub API
      const response = await fetch(this.githubApiUrl);
      if (response.ok) {
        const githubData = await response.json();
        const data = this.transformGitHubData(githubData);
        this.cache = data;
        this.lastFetch = now;
        console.log('[ReleaseManager] ✅ Fetched from GitHub API:', data.version);
        return data;
      }
    } catch (error) {
      console.error('[ReleaseManager] Both APIs failed:', error.message);
    }

    // Return cached data even if expired, or throw error
    if (this.cache) {
      console.warn('[ReleaseManager] Using expired cache data');
      return this.cache;
    }

    // Final fallback to hardcoded beta version
    console.error('[ReleaseManager] All endpoints failed, using hardcoded fallback');
    return this.getHardcodedFallback();
  }

  /**
   * Transform GitHub API response to our format
   * @param {Object} githubData - GitHub API response
   * @returns {Object} Normalized release data
   */
  transformGitHubData(githubData) {
    const version = githubData.tag_name.replace(/^v/, '');
    const assets = githubData.assets;
    
    // Find the download URLs by matching file patterns
    const windowsAsset = assets.find(a => a.name.match(/Junior.*Setup.*\.exe/i));
    const macosIntelAsset = assets.find(a => a.name.match(/Junior.*\.dmg/i) && !a.name.match(/arm64/i));
    const macosArmAsset = assets.find(a => a.name.match(/Junior.*arm64.*\.dmg/i));
    
    return {
      version: version,
      tag: githubData.tag_name,
      release_date: githubData.published_at,
      downloads: {
        windows: windowsAsset?.browser_download_url || '',
        macos_intel: macosIntelAsset?.browser_download_url || '',
        macos_arm: macosArmAsset?.browser_download_url || ''
      },
      release_url: githubData.html_url
    };
  }

  /**
   * Hardcoded fallback for when all APIs fail
   * @returns {Object} Fallback release data
   */
  getHardcodedFallback() {
    return {
      version: "1.0.0",
      tag: "v1.0.0-beta",
      release_date: new Date().toISOString(),
      downloads: {
        windows: "https://github.com/Andrew-AI-JR/Desktop-Releases/releases/download/v1.0.0-beta/Junior.Setup.1.0.0.exe",
        macos_intel: "https://github.com/Andrew-AI-JR/Desktop-Releases/releases/download/v1.0.0-beta/Junior-1.0.0.dmg",
        macos_arm: "https://github.com/Andrew-AI-JR/Desktop-Releases/releases/download/v1.0.0-beta/Junior-1.0.0-arm64.dmg"
      },
      release_url: "https://github.com/Andrew-AI-JR/Desktop-Releases/releases/tag/v1.0.0-beta"
    };
  }

  /**
   * Get platform-specific download URL
   * @param {string} platform - 'windows', 'macos', 'macos_arm', or 'auto'
   * @returns {Promise<string>} Download URL
   */
  async getDownloadUrl(platform = 'auto') {
    const release = await this.getLatestRelease();
    
    if (platform === 'auto') {
      platform = this.detectPlatform();
    }
    
    switch (platform) {
      case 'windows':
        return release.downloads.windows;
      case 'macos':
        // Auto-detect ARM vs Intel
        return this.isMacARM() ? release.downloads.macos_arm : release.downloads.macos_intel;
      case 'macos_intel':
        return release.downloads.macos_intel;
      case 'macos_arm':
        return release.downloads.macos_arm;
      default:
        console.warn('[ReleaseManager] Unknown platform:', platform);
        return release.downloads.windows;
    }
  }

  /**
   * Detect user's platform
   * @returns {string} Platform identifier
   */
  detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    if (userAgent.includes('win') || platform.includes('win')) {
      return 'windows';
    }
    
    if (userAgent.includes('mac') || platform.includes('mac')) {
      return this.isMacARM() ? 'macos_arm' : 'macos_intel';
    }
    
    if (userAgent.includes('linux') || platform.includes('linux')) {
      return 'linux';
    }
    
    // Default to Windows
    return 'windows';
  }

  /**
   * Check if running on Apple Silicon Mac
   * @returns {boolean} True if ARM-based Mac
   */
  isMacARM() {
    const userAgent = navigator.userAgent;
    
    // Check for Apple Silicon indicators
    // This is best-effort - may not be 100% accurate
    if (navigator.platform === 'MacIntel') {
      // Modern Macs report MacIntel even for ARM
      // Let users choose or default to ARM for newer Macs
      return navigator.maxTouchPoints > 0; // Apple Silicon Macs have touch support
    }
    
    // Default to Intel if unsure
    return false;
  }

  /**
   * Get formatted version string
   * @returns {Promise<string>} Version string (e.g., "v1.0.1")
   */
  async getVersionString() {
    const release = await this.getLatestRelease();
    return `v${release.version}`;
  }

  /**
   * Get human-readable release date
   * @returns {Promise<string>} Formatted date
   */
  async getReleaseDate() {
    const release = await this.getLatestRelease();
    return new Date(release.release_date).toLocaleDateString();
  }

  /**
   * Get all download URLs at once
   * @returns {Promise<Object>} All download URLs
   */
  async getAllDownloadUrls() {
    const release = await this.getLatestRelease();
    return release.downloads;
  }
}

// Create global instance
window.juniorReleaseManager = new JuniorReleaseManager();

console.log('[ReleaseManager] Global instance created and ready');
