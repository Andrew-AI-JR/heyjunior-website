/**
 * API origin for checkout, portal, try-it demo, etc.
 *
 * Production: https://api.heyjunior.ai
 *
 * Local dev: js/api-config.local.js (written by ./serve.sh) or default :8001
 */
(function () {
  var PRODUCTION_API = 'https://api.heyjunior.ai';
  var DEFAULT_LOCAL_PORT = 8001;
  var STORAGE_BASE = 'juniorLocalApiBaseUrl';
  var STORAGE_PORT = 'juniorLocalApiPort';

  function isLocalHost() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function normalizeBase(url) {
    return String(url).replace(/\/+$/, '');
  }

  function loadLocalConfigFile() {
    if (window.__JUNIOR_API_CONFIG__) return;
    var script = document.currentScript;
    if (!script || !script.src) return;
    try {
      var localUrl = new URL('api-config.local.js', script.src).href;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', localUrl, false);
      xhr.send(null);
      if (xhr.status === 200 && xhr.responseText) {
        // eslint-disable-next-line no-eval
        (0, eval)(xhr.responseText);
      }
    } catch (_e) {
      /* optional file missing */
    }
  }

  function applyQueryOverrides() {
    if (!isLocalHost()) return;
    var params = new URLSearchParams(window.location.search);
    var base = params.get('api_base');
    var port = params.get('api_port');
    if (base) {
      try {
        localStorage.setItem(STORAGE_BASE, normalizeBase(base));
      } catch (_e) {}
      return;
    }
    if (port && /^\d+$/.test(port)) {
      try {
        localStorage.setItem(STORAGE_PORT, port);
      } catch (_e) {}
    }
  }

  function getLocalApiBaseUrl() {
    loadLocalConfigFile();

    var cfg = window.__JUNIOR_API_CONFIG__ || {};
    if (cfg.localApiBaseUrl) {
      return normalizeBase(cfg.localApiBaseUrl);
    }

    try {
      var storedBase = localStorage.getItem(STORAGE_BASE);
      if (storedBase) return normalizeBase(storedBase);
    } catch (_e) {}

    var port = cfg.localApiPort;
    if (port == null) {
      try {
        var storedPort = localStorage.getItem(STORAGE_PORT);
        if (storedPort && /^\d+$/.test(storedPort)) port = storedPort;
      } catch (_e2) {}
    }
    if (port == null) port = DEFAULT_LOCAL_PORT;

    return window.location.protocol + '//' + window.location.hostname + ':' + port;
  }

  function getApiBaseUrl() {
    if (isLocalHost()) {
      return getLocalApiBaseUrl();
    }
    return PRODUCTION_API;
  }

  function setLocalApiConfig(options) {
    if (!isLocalHost()) return;
    options = options || {};
    try {
      if (options.baseUrl != null) {
        localStorage.setItem(STORAGE_BASE, normalizeBase(options.baseUrl));
        localStorage.removeItem(STORAGE_PORT);
      } else if (options.port != null) {
        localStorage.setItem(STORAGE_PORT, String(options.port));
        localStorage.removeItem(STORAGE_BASE);
      }
      if (options.clear) {
        localStorage.removeItem(STORAGE_BASE);
        localStorage.removeItem(STORAGE_PORT);
        delete window.__JUNIOR_API_CONFIG__;
      }
    } catch (_e) {}
  }

  applyQueryOverrides();
  loadLocalConfigFile();

  window.getApiBaseUrl = getApiBaseUrl;
  window.setJuniorLocalApiConfig = setLocalApiConfig;
})();
