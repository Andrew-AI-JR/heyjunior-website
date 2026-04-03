/**
 * Single source of truth for API origin (see reseller / Connect integration).
 * Local dev: API expected on port 8001 (serve this static site on another port, e.g. 8000).
 */
(function () {
  function getApiBaseUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return window.location.origin.replace(/:\d+$/, ':8001');
    }
    return 'https://api.heyjunior.ai';
  }
  window.getApiBaseUrl = getApiBaseUrl;
})();
