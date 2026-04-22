(function () {
  var qs = new URLSearchParams(window.location.search);
  var src = qs.get('src');

  if (src) {
    sessionStorage.setItem('marketingSource', src);
  }

  function getSource() {
    return sessionStorage.getItem('marketingSource') || 'direct';
  }

  function trackEvent(name, props) {
    var payload = Object.assign({ source: getSource() }, props || {});

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
