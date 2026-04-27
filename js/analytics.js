(function () {
  var qs = new URLSearchParams(window.location.search);
  var src = qs.get('src');
  var queueKey = 'juniorAnalyticsQueue';
  var anonymousIdKey = 'juniorAnonymousId';
  var sessionIdKey = 'juniorSessionId';
  var maxQueueSize = 100;
  var batchSize = 20;
  var flushTimer = null;
  var flushing = false;

  if (src) {
    safeSet(sessionStorage, 'marketingSource', src);
  }

  var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  utmKeys.forEach(function (key) {
    var val = qs.get(key);
    if (val) safeSet(sessionStorage, key, val);
  });

  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (e) {
      // Tracking must never block conversion paths when storage is unavailable.
    }
  }

  function getSource() {
    return safeGet(sessionStorage, 'marketingSource') || 'direct';
  }

  function getUtm() {
    var utm = {};
    utmKeys.forEach(function (key) {
      var val = safeGet(sessionStorage, key);
      if (val) utm[key] = val;
    });
    return utm;
  }

  function getAnalyticsBaseUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    return 'https://api.heyjunior.ai';
  }

  function uuid(prefix) {
    var randomPart = '';
    if (window.crypto && window.crypto.getRandomValues) {
      var values = new Uint32Array(4);
      window.crypto.getRandomValues(values);
      randomPart = Array.prototype.map.call(values, function (value) {
        return value.toString(16);
      }).join('');
    } else {
      randomPart = Math.random().toString(16).slice(2) + Date.now().toString(16);
    }
    return prefix + '_' + randomPart.slice(0, 48);
  }

  function getAnonymousId() {
    var id = safeGet(localStorage, anonymousIdKey);
    if (!id) {
      id = uuid('anon');
      safeSet(localStorage, anonymousIdKey, id);
    }
    return id;
  }

  function getSessionId() {
    var id = safeGet(sessionStorage, sessionIdKey);
    if (!id) {
      id = uuid('sess');
      safeSet(sessionStorage, sessionIdKey, id);
    }
    return id;
  }

  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem(queueKey) || '[]');
    } catch (e) {
      return [];
    }
  }

  function setQueue(queue) {
    try {
      localStorage.setItem(queueKey, JSON.stringify(queue.slice(-maxQueueSize)));
    } catch (e) {
      // If persistent queueing is unavailable, drop queued analytics instead of hurting UX.
    }
  }

  function enqueue(event) {
    var queue = getQueue();
    queue.push(event);
    setQueue(queue);
    scheduleFlush(250);
  }

  function scheduleFlush(delay) {
    if (flushTimer) window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flushQueue, delay || 1000);
  }

  function postBatch(events) {
    return window.fetch(getAnalyticsBaseUrl() + '/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ events: events }),
      keepalive: true
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Analytics request failed: ' + response.status);
      }
      return response;
    });
  }

  function flushQueue() {
    if (flushing) return;
    var queue = getQueue();
    if (!queue.length) return;

    flushing = true;
    var batch = queue.slice(0, batchSize);

    postBatch(batch).then(function () {
      var remaining = getQueue().slice(batch.length);
      setQueue(remaining);
      flushing = false;
      if (remaining.length) scheduleFlush(500);
    }).catch(function () {
      flushing = false;
      scheduleFlush(5000);
    });
  }

  function flushWithBeacon() {
    var queue = getQueue();
    if (!queue.length || !navigator.sendBeacon) return;

    var batch = queue.slice(0, batchSize);
    var payload = JSON.stringify({ events: batch });
    var blob = new Blob([payload], { type: 'application/json' });
    var sent = navigator.sendBeacon(getAnalyticsBaseUrl() + '/api/analytics/events', blob);
    if (sent) {
      setQueue(queue.slice(batch.length));
    }
  }

  function trackEvent(name, props) {
    var base = {
      source: getSource(),
      page: document.body ? document.body.getAttribute('data-page') || 'unknown' : 'unknown',
      path: window.location.pathname,
      referrer: document.referrer || null
    };
    var payload = Object.assign(base, getUtm(), props || {});
    var event = {
      event_id: uuid('evt'),
      event_name: name,
      anonymous_id: getAnonymousId(),
      session_id: getSessionId(),
      user_id: safeGet(sessionStorage, 'userId') || safeGet(localStorage, 'userId') || null,
      source: payload.source,
      page: payload.page,
      path: payload.path,
      referrer: payload.referrer,
      utm_source: payload.utm_source || null,
      utm_medium: payload.utm_medium || null,
      utm_campaign: payload.utm_campaign || null,
      utm_term: payload.utm_term || null,
      utm_content: payload.utm_content || null,
      properties: props || {},
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString()
    };

    console.info('[juniorTrack]', name, payload);
    window.dispatchEvent(new CustomEvent('juniorTrack', {
      detail: {
        name: name,
        payload: payload,
        event: event
      }
    }));

    enqueue(event);

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
  window.juniorFlushAnalytics = flushQueue;

  document.addEventListener('click', function (event) {
    var el = event.target.closest('[data-cta]');
    if (!el) return;

    trackEvent('cta_click', {
      location: el.getAttribute('data-cta'),
      href: el.getAttribute('href')
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    trackEvent('page_view', {
      title: document.title
    });
  });

  window.addEventListener('online', function () {
    scheduleFlush(100);
  });

  window.addEventListener('pagehide', flushWithBeacon);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushWithBeacon();
  });

  scheduleFlush(1000);
})();
