/**
 * Try-it page demo controller (try-it.html).
 */
(function () {
  var MAX_ATTEMPTS = 3;
  var REQUEST_TIMEOUT_MS = 90000;
  var LOADER_MESSAGES = [
    'Understanding the post…',
    'Finding your angle…',
    'Writing your comment…'
  ];
  var LOADER_INTERVAL_MS = 4000;

  var STORAGE = {
    attempts: 'juniorTryItAttempts',
    draft: 'juniorTryItDraft',
    userBio: 'juniorTryItUserBio',
    suggestedAngle: 'juniorTryItSuggestedAngle'
  };

  var state = {
    postText: '',
    userBio: '',
    tone: 'professional',
    suggestedAngle: '',
    comment: null,
    verified: false,
    fallback: false,
    status: 'idle',
    isRegenerate: false
  };

  var activeAbort = null;
  var loaderTimer = null;
  var loaderIndex = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function track(name, data) {
    if (window.juniorTrack) window.juniorTrack(name, data || {});
  }

  function getAttempts() {
    return Number(sessionStorage.getItem(STORAGE.attempts) || '0');
  }

  function setAttempts(value) {
    sessionStorage.setItem(STORAGE.attempts, String(value));
  }

  function syncAttemptsToMax() {
    setAttempts(MAX_ATTEMPTS);
  }

  function remainingAttempts() {
    return Math.max(0, MAX_ATTEMPTS - getAttempts());
  }

  function isLockedOut() {
    return getAttempts() >= MAX_ATTEMPTS;
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(STORAGE.draft);
      if (!raw) return;
      var draft = JSON.parse(raw);
      if (draft.postText) state.postText = draft.postText;
      if (draft.userBio) state.userBio = draft.userBio;
      if (draft.tone) state.tone = draft.tone;
    } catch (_e) {
      /* ignore corrupt draft */
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(
        STORAGE.draft,
        JSON.stringify({
          postText: state.postText,
          userBio: state.userBio,
          tone: state.tone
        })
      );
    } catch (_e) {
      /* private browsing / quota */
    }
  }

  function persistSignupContext() {
    if (state.userBio.trim()) {
      sessionStorage.setItem(STORAGE.userBio, state.userBio.trim());
    }
    if (state.suggestedAngle.trim()) {
      sessionStorage.setItem(STORAGE.suggestedAngle, state.suggestedAngle.trim());
    }
  }

  function buildSignupUrl(src) {
    var url = 'register.html?src=' + encodeURIComponent(src) + '&ref=demo';
    if (state.suggestedAngle.trim()) {
      url += '&angle=' + encodeURIComponent(state.suggestedAngle.trim());
    }
    return url;
  }

  function updateSignupLinks() {
    var lockoutCta = $('tryit-lockout-cta');
    var successCta = $('tryit-success-cta');
    var href = buildSignupUrl('tryit');
    if (lockoutCta) lockoutCta.href = buildSignupUrl('tryit-lockout');
    if (successCta) successCta.href = href;
  }

  function setError(message) {
    var el = $('tryit-demo-error');
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

  function clearError() {
    setError('');
  }

  function setLoaderMessage(message) {
    var el = $('tryit-loader');
    if (el) el.textContent = message;
  }

  function startLoader() {
    loaderIndex = 0;
    setLoaderMessage(LOADER_MESSAGES[0]);
    var loaderEl = $('tryit-loader');
    if (loaderEl) loaderEl.hidden = false;

    stopLoader(false);
    loaderTimer = setInterval(function () {
      loaderIndex = (loaderIndex + 1) % LOADER_MESSAGES.length;
      setLoaderMessage(LOADER_MESSAGES[loaderIndex]);
    }, LOADER_INTERVAL_MS);
  }

  function stopLoader(hide) {
    if (loaderTimer) {
      clearInterval(loaderTimer);
      loaderTimer = null;
    }
    if (hide !== false) {
      var loaderEl = $('tryit-loader');
      if (loaderEl) loaderEl.hidden = true;
    }
  }

  function abortActiveRequest() {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
  }

  function readFormIntoState() {
    var postInput = $('tryit-post');
    var bioInput = $('tryit-bio');
    var toneInput = $('tryit-tone');
    state.postText = postInput ? postInput.value : '';
    state.userBio = bioInput ? bioInput.value : '';
    state.tone = toneInput ? toneInput.value : 'professional';
    saveDraft();
  }

  function syncFormFromState() {
    var postInput = $('tryit-post');
    var bioInput = $('tryit-bio');
    var toneInput = $('tryit-tone');
    if (postInput) postInput.value = state.postText;
    if (bioInput) bioInput.value = state.userBio;
    if (toneInput) toneInput.value = state.tone;
    updateCharCounts();
  }

  function updateCharCounts() {
    var postCount = $('tryit-post-count');
    var bioCount = $('tryit-bio-count');
    var bioWarn = $('tryit-bio-warn');
    var postLen = state.postText.length;
    var bioLen = state.userBio.length;

    if (postCount) {
      postCount.textContent = postLen + ' / 3000 (min 20)';
      postCount.classList.toggle('tryit-count-warn', postLen > 0 && postLen < 20);
    }
    if (bioCount) bioCount.textContent = bioLen + ' / 2000';
    if (bioWarn) bioWarn.hidden = bioLen > 0;
  }

  function updateAttemptsUI() {
    var attemptsHelp = $('tryit-attempts-help');
    var remaining = remainingAttempts();
    if (attemptsHelp) {
      attemptsHelp.textContent =
        remaining > 0 ? remaining + ' free tries remaining.' : 'No free tries remaining.';
    }
  }

  function showLockout(message) {
    state.status = 'rate_limited';
    var formSection = $('try-it');
    var lockout = $('tryit-lockout');
    var lockoutMsg = $('tryit-lockout-message');
    var generateBtn = $('tryit-demo-button');
    var regenerateBtn = $('tryit-regenerate-button');

    if (formSection) formSection.hidden = true;
    if (lockout) lockout.hidden = false;
    if (lockoutMsg && message) lockoutMsg.textContent = message;
    if (generateBtn) generateBtn.disabled = true;
    if (regenerateBtn) regenerateBtn.disabled = true;
    updateSignupLinks();
  }

  function showResult(data) {
    state.comment = data.comment || '';
    state.fallback = Boolean(data.fallback);
    state.verified = Boolean(data.verified);
    state.suggestedAngle =
      (data.qualification && data.qualification.suggested_angle) ||
      data.suggested_angle ||
      state.suggestedAngle ||
      '';

    var result = $('tryit-demo-result');
    var commentBox = $('tryit-demo-comment');
    var angleInput = $('tryit-suggested-angle');
    var approachBlock = $('tryit-approach-block');
    var fallbackNote = $('tryit-fallback-note');
    var verifiedBadge = $('tryit-verified-badge');

    if (commentBox) commentBox.textContent = state.comment;
    if (angleInput) angleInput.value = state.suggestedAngle;
    if (approachBlock) approachBlock.hidden = false;

    if (fallbackNote) fallbackNote.hidden = !state.fallback;
    if (verifiedBadge) verifiedBadge.hidden = !(state.verified && !state.fallback);

    if (result) {
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    persistSignupContext();
    updateSignupLinks();

    if (state.fallback) {
      track('tryit_fallback_shown', { source: 'try-it-page' });
    } else {
      track('tryit_result_shown', { source: 'try-it-page', verified: state.verified });
    }
  }

  function validatePost() {
    if (state.postText.trim().length < 20) {
      setError('Paste at least 20 characters from a LinkedIn post.');
      return false;
    }
    return true;
  }

  function validateRegenerate() {
    if (!validatePost()) return false;
    var angle = ($('tryit-suggested-angle') || {}).value || '';
    if (!angle.trim()) {
      setError('Add a suggested approach before regenerating, or edit the one above.');
      return false;
    }
    state.suggestedAngle = angle.trim();
    return true;
  }

  async function runGeneration(isRegenerate) {
    if (isLockedOut()) {
      showLockout("You've seen how it works. Create your account to generate more comments.");
      return;
    }

    readFormIntoState();
    clearError();

    if (isRegenerate) {
      if (!validateRegenerate()) return;
    } else if (!validatePost()) {
      return;
    }

    if (window.juniorTrack) {
      track(isRegenerate ? 'tryit_regenerate_clicked' : 'tryit_generate_clicked', {
        source: 'try-it-page'
      });
    }

    abortActiveRequest();
    var abortController = new AbortController();
    activeAbort = abortController;

    var timeoutId = setTimeout(function () {
      abortController.abort();
    }, REQUEST_TIMEOUT_MS);

    var generateBtn = $('tryit-demo-button');
    var regenerateBtn = $('tryit-regenerate-button');
    if (generateBtn) generateBtn.disabled = true;
    if (regenerateBtn) regenerateBtn.disabled = true;
    startLoader();
    state.status = 'loading';

    var payload = isRegenerate
      ? window.DemoCommentClient.buildRegeneratePayload(state)
      : window.DemoCommentClient.buildInitialPayload(state);

    try {
      var data = await window.DemoCommentClient.generateDemoComment(payload, abortController.signal);
      clearTimeout(timeoutId);

      setAttempts(getAttempts() + 1);
      updateAttemptsUI();
      showResult(data);
      state.status = 'success';

      if (isLockedOut()) {
        showLockout("You've seen how it works. Create your account to generate more comments.");
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err && err.name === 'AbortError') {
        setError('This is taking longer than expected. Please try again.');
      } else if (err && err.name === 'DemoRateLimitError') {
        syncAttemptsToMax();
        updateAttemptsUI();
        showLockout(err.message);
        track('tryit_rate_limited', { source: 'try-it-page' });
      } else if (err && err.name === 'DemoValidationError') {
        setError(err.message);
        state.status = 'error';
      } else {
        setError(
          (err && err.message) || 'Unable to generate a comment right now. Please try again.'
        );
        state.status = 'error';
      }
    } finally {
      stopLoader();
      activeAbort = null;
      if (!isLockedOut()) {
        if (generateBtn) generateBtn.disabled = false;
        if (regenerateBtn) regenerateBtn.disabled = false;
      }
    }
  }

  function copyComment() {
    var commentBox = $('tryit-demo-comment');
    var copyButton = $('tryit-copy-comment');
    if (!commentBox || !copyButton) return;

    var text = commentBox.textContent.trim();
    if (!text) return;

    navigator.clipboard.writeText(text).then(
      function () {
        var original = copyButton.textContent;
        copyButton.textContent = 'Copied';
        setTimeout(function () {
          copyButton.textContent = original;
        }, 1500);
      },
      function () {
        setError('Could not copy to clipboard. Select the comment and copy manually.');
      }
    );
  }

  function initMobileNav() {
    var mobileToggle = document.querySelector('.mobile-menu-toggle');
    var navLinks = document.querySelector('.nav-links');
    if (mobileToggle && navLinks) {
      mobileToggle.addEventListener('click', function () {
        navLinks.classList.toggle('active');
        mobileToggle.classList.toggle('active');
      });
    }
  }

  function init() {
    if (!window.DemoCommentClient) return;

    loadDraft();
    syncFormFromState();
    updateAttemptsUI();
    updateSignupLinks();

    if (isLockedOut()) {
      showLockout("You've seen how it works. Create your account to generate more comments.");
    }

    var form = $('tryit-demo-form');
    var postInput = $('tryit-post');
    var bioInput = $('tryit-bio');
    var toneInput = $('tryit-tone');
    var regenerateBtn = $('tryit-regenerate-button');
    var copyButton = $('tryit-copy-comment');

    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        runGeneration(false);
      });
    }

    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', function () {
        runGeneration(true);
      });
    }

    if (copyButton) copyButton.addEventListener('click', copyComment);

    [postInput, bioInput, toneInput].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', function () {
        readFormIntoState();
        updateCharCounts();
      });
    });

    window.addEventListener('beforeunload', abortActiveRequest);

    track('tryit_page_view', { source: 'try-it-page' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    init();
  });
})();
