/**
 * Junior help assistant: answers questions from the help pages (POST /api/help/ask).
 *
 * Inline: put <div id="help-assistant"></div> on the page.
 * Floating: any page that loads this script without that element gets a "Help" button.
 * Needs js/api-config.js loaded first (window.JUNIOR_API_BASE / getApiBaseUrl).
 */
(function () {
  'use strict';

  var SUPPORT = 'support@heyjunior.ai';
  var STORE = 'juniorHelpChat';
  var history = [];

  function apiBase() {
    if (typeof window.getApiBaseUrl === 'function') return window.getApiBaseUrl();
    return window.JUNIOR_API_BASE || 'https://api.heyjunior.ai';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function load() {
    try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]').slice(-12); } catch (e) { history = []; }
  }

  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-12))); } catch (e) { /* private mode */ }
  }

  function sourceLabel(url) {
    var m = /\/([\w-]+)\.html(?:#([\w-]+))?/.exec(url);
    if (!m) return url;
    var page = { troubleshooting: 'Troubleshooting', 'setup-guide': 'Setup guide', 'mac-install-help': 'Mac install help',
      'windows-install-help': 'Windows install help', 'whats-new': "What's new", help: 'Help center' }[m[1]] || m[1];
    return m[2] ? page + ': ' + m[2].replace(/-/g, ' ') : page;
  }

  function renderMessage(list, msg) {
    var item = el('div', 'ha-msg ha-' + msg.role);
    var body = el('div', 'ha-bubble');
    String(msg.text).split(/\n+/).forEach(function (line) { body.appendChild(el('p', '', line)); });
    if (msg.sources && msg.sources.length) {
      var links = el('div', 'ha-sources');
      links.appendChild(el('span', '', 'Read more: '));
      msg.sources.forEach(function (url, i) {
        var a = el('a', '', sourceLabel(url));
        a.href = url;
        links.appendChild(a);
        if (i < msg.sources.length - 1) links.appendChild(document.createTextNode(' · '));
      });
      body.appendChild(links);
    }
    if (msg.escalate) {
      var mail = el('a', 'ha-email', 'Email ' + SUPPORT);
      var last = history.filter(function (h) { return h.role === 'user'; }).pop();
      mail.href = 'mailto:' + SUPPORT + '?subject=' + encodeURIComponent('Help with Junior') +
        '&body=' + encodeURIComponent((last ? 'My question: ' + last.text + '\n\n' : '') +
        'My computer (Windows or Mac):\nWhat I already tried:\n');
      body.appendChild(mail);
    }
    item.appendChild(body);
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
  }

  function build(host, floating) {
    var box = el('div', 'ha-box' + (floating ? ' ha-floating' : ''));
    var head = el('div', 'ha-head');
    head.appendChild(el('strong', '', 'Ask Junior help'));
    head.appendChild(el('span', 'ha-note', 'Answers come from our help pages. Never share passwords here.'));
    if (floating) {
      var close = el('button', 'ha-close', '×');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close help');
      close.addEventListener('click', function () { box.hidden = true; });
      head.appendChild(close);
    }
    var list = el('div', 'ha-list');
    list.setAttribute('aria-live', 'polite');
    var form = el('form', 'ha-form');
    var input = el('textarea', 'ha-input');
    input.rows = 2;
    input.maxLength = 600;
    input.placeholder = 'Describe the problem, e.g. "Chrome closes right after I click Start"';
    input.setAttribute('aria-label', 'Your question');
    var send = el('button', 'ha-send', 'Ask');
    send.type = 'submit';
    form.appendChild(input);
    form.appendChild(send);
    box.appendChild(head);
    box.appendChild(list);
    box.appendChild(form);

    if (!history.length) {
      renderMessage(list, { role: 'assistant', text: 'Hi! Ask me anything about installing, setting up or using Junior, your trial, or billing.' });
    }
    history.forEach(function (m) { renderMessage(list, m); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : send.click(); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q || send.disabled) return;
      var past = history.slice(-6).map(function (m) { return { role: m.role, text: String(m.text).slice(0, 2000) }; });
      var mine = { role: 'user', text: q };
      history.push(mine);
      renderMessage(list, mine);
      input.value = '';
      send.disabled = true;
      var wait = el('div', 'ha-msg ha-assistant ha-wait');
      wait.appendChild(el('div', 'ha-bubble', 'Looking through the help pages…'));
      list.appendChild(wait);
      list.scrollTop = list.scrollHeight;
      if (typeof window.trackEvent === 'function') { try { window.trackEvent('help_assistant_ask'); } catch (err) { /* ignore */ } }

      fetch(apiBase() + '/api/help/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history: past })
      }).then(function (res) {
        if (res.status === 429) return { answer: "You've asked a lot of questions in a short time. Please wait a minute, or email us.", sources: [], escalate: true };
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).catch(function () {
        return { answer: "I couldn't reach the help service just now.", sources: [], escalate: true };
      }).then(function (data) {
        wait.remove();
        var reply = { role: 'assistant', text: data.answer, sources: data.sources || [], escalate: !!data.escalate };
        history.push(reply);
        save();
        renderMessage(list, reply);
        send.disabled = false;
        input.focus();
      });
    });

    host.appendChild(box);
    return box;
  }

  function init() {
    load();
    var inline = document.getElementById('help-assistant');
    if (inline) { build(inline, false); return; }
    var btn = el('button', 'ha-launch', 'Help');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open help assistant');
    var box = null;
    btn.addEventListener('click', function () {
      if (!box) box = build(document.body, true);
      box.hidden = false;
      box.querySelector('.ha-input').focus();
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
