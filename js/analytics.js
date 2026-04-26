(function () {
  var qs = new URLSearchParams(window.location.search);
  var src = qs.get('src');

  if (src) {
    sessionStorage.setItem('marketingSource', src);
  }

  var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  utmKeys.forEach(function (key) {
    var val = qs.get(key);
    if (val) sessionStorage.setItem(key, val);
  });

  function getSource() {
    return sessionStorage.getItem('marketingSource') || 'direct';
  }

  function getUtm() {
    var utm = {};
    utmKeys.forEach(function (key) {
      var val = sessionStorage.getItem(key);
      if (val) utm[key] = val;
    });
    return utm;
  }

  function trackEvent(name, props) {
    var base = {
      source: getSource(),
      page: document.body.getAttribute('data-page') || 'unknown',
      path: window.location.pathname
    };
    var payload = Object.assign(base, getUtm(), props || {});

    console.info('[juniorTrack]', name, payload);
    window.dispatchEvent(new CustomEvent('juniorTrack', {
      detail: {
        name: name,
        payload: payload
      }
    }));

    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
    }

    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', name, payload);
    }

    if (typeof window.rdt === 'function') {
      window.rdt('track', 'Custom', Object.assign({ customEventName: name }, payload));
    }
  }

  window.juniorTrack = trackEvent;

  document.addEventListener('click', function (event) {
    var el = event.target.closest('[data-cta]');
    if (!el) return;

    trackEvent('cta_click', {
      location: el.getAttribute('data-cta'),
      href: el.getAttribute('href')
    });
  });
})();
