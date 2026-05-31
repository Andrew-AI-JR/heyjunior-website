/**
 * Local API overrides (dev only).
 *
 * 1. Copy this file to api-config.local.js (same folder).
 * 2. Edit port or base URL below.
 * 3. api-config.local.js is gitignored — do not commit secrets here.
 *
 * api-config.js loads this automatically on localhost / 127.0.0.1.
 */
window.__JUNIOR_API_CONFIG__ = {
  // Full origin (takes precedence over port):
  // localApiBaseUrl: 'http://127.0.0.1:8001',

  localApiPort: 8001
};
