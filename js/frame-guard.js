/**
 * Break out of embedding iframes (clickjacking mitigation).
 * Prefer HTTP headers (X-Frame-Options / CSP frame-ancestors) when the host supports them.
 */
(function () {
  'use strict';
  if (window.self === window.top) {
    return;
  }
  try {
    window.top.location = window.self.location;
  } catch (_) {
    var style = document.createElement('style');
    style.textContent = 'html,body{display:none!important}';
    (document.documentElement || document.head).appendChild(style);
  }
})();
