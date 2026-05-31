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

  var SAMPLE_SCENARIOS = [
    {
      label: 'Data engineer',
      post:
        "We're hiring a senior data engineer to build scalable data pipelines, improve analytics reliability, and help our platform grow. Experience with Python, SQL, and cloud data tooling is a plus.",
      bio:
        "Data engineer with 5 years building ETL pipelines in Python and AWS. I've optimized production analytics workflows and enjoy connecting data systems to business outcomes."
    },
    {
      label: 'Product manager',
      post:
        "Looking for a product manager to own our B2B SaaS roadmap, run discovery with customers, and ship features that move activation and retention. You'll partner closely with eng and design.",
      bio:
        "PM with 6 years in B2B SaaS. I've launched onboarding flows that lifted activation 30% and run weekly customer interviews to prioritize the roadmap."
    },
    {
      label: 'Frontend engineer',
      post:
        "We're growing our frontend team and hiring a React engineer to improve performance, design systems, and accessibility across our customer dashboard. Remote-friendly.",
      bio:
        "Frontend engineer focused on React, TypeScript, and accessible UI. I've led design-system migrations and cut dashboard load times with smarter data fetching."
    },
    {
      label: 'ML engineer',
      post:
        "Hiring an ML engineer to productionize models, improve inference latency, and build evaluation pipelines for our recommendation stack. PyTorch or TensorFlow experience welcome.",
      bio:
        "ML engineer shipping models to production for 4 years. I care about evals, monitoring, and the gap between notebook experiments and reliable services."
    }
  ];

  var sampleIndex = 0;

  var STORAGE = {
    attempts: 'juniorTryItAttempts',
    draft: 'juniorTryItDraft',
    userBio: 'juniorTryItUserBio',
    suggestedAngle: 'juniorTryItSuggestedAngle',
    lastResult: 'juniorTryItLastResult'
  };

  var state = {
    postText: '',
    userBio: '',
    tone: 'professional',
    suggestedAngle: '',
    comment: null,
    verified: false,
    fallback: false,
    shouldComment: null,
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
      postCount.textContent = postLen + ' / 3000 · min 20 characters';
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

  function setFormDisabled(disabled) {
    var formSection = $('try-it');
    var generateBtn = $('tryit-demo-button');
    var regenerateBtn = $('tryit-regenerate-button');
    var sampleBtn = $('tryit-load-sample');
    var postInput = $('tryit-post');
    var bioInput = $('tryit-bio');
    var toneInput = $('tryit-tone');

    if (formSection) formSection.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (generateBtn) generateBtn.disabled = disabled;
    if (regenerateBtn) regenerateBtn.disabled = disabled;
    if (sampleBtn) sampleBtn.disabled = disabled;
    [postInput, bioInput, toneInput].forEach(function (el) {
      if (el) el.disabled = disabled;
    });
  }

  function scrollToResult() {
    var result = $('tryit-demo-result');
    if (result && !result.hidden) {
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function persistLastResult(data) {
    try {
      sessionStorage.setItem(STORAGE.lastResult, JSON.stringify(data));
    } catch (_e) {
      /* quota / private browsing */
    }
  }

  function restoreLastResult() {
    try {
      var raw = sessionStorage.getItem(STORAGE.lastResult);
      if (!raw) return false;
      showResult(JSON.parse(raw));
      return true;
    } catch (_e) {
      return false;
    }
  }

  function showLockout(message, options) {
    options = options || {};
    state.status = 'rate_limited';
    var formSection = $('try-it');
    var lockout = $('tryit-lockout');
    var lockoutMsg = $('tryit-lockout-message');
    var result = $('tryit-demo-result');
    var hasVisibleResult = result && !result.hidden;

    if (options.keepFormVisible) {
      setFormDisabled(true);
    } else if (formSection) {
      formSection.hidden = true;
      setFormDisabled(true);
    } else {
      setFormDisabled(true);
    }

    if (lockout) lockout.hidden = false;
    if (lockoutMsg && message) lockoutMsg.textContent = message;
    updateSignupLinks();

    if (options.scrollToResult && hasVisibleResult) {
      requestAnimationFrame(function () {
        requestAnimationFrame(scrollToResult);
      });
    }
  }

  function buildWhatHappenedSteps(data, isSampleOnly) {
    var qual = data.qualification || {};
    var angle = qual.suggested_angle || data.suggested_angle || '';
    var score = typeof qual.priority_score === 'number' ? qual.priority_score : null;
    var reasons = Array.isArray(qual.match_reasons) ? qual.match_reasons : [];

    if (isSampleOnly) {
      if (qual.should_comment === false) {
        return {
          validate:
            'We read your LinkedIn post and your background. This demo only personalizes hiring posts, and this one did not qualify.',
          approach: 'Junior did not pick a personalized approach for this post.',
          comment:
            'What you see below is a generic example, not a comment built from your post and profile. Try one of the sample hiring posts above.'
        };
      }
      return {
        validate: 'We read your post and profile, but could not personalize this run.',
        approach: 'No approach was applied.',
        comment:
          'What you see below is a generic sample, not a comment tailored to your inputs.'
      };
    }

    var validateText =
      'We read the LinkedIn post you pasted and matched it against your background.';
    if (score != null) {
      validateText += ' The fit scored ' + score + ' out of 100.';
    }
    if (reasons.length) {
      validateText += ' Here is why this post is worth a comment:';
    } else {
      validateText += ' This looks like a good post to engage with.';
    }

    var approachText = angle
      ? 'Based on that match, Junior chose this approach: “' + angle + '”.'
      : 'Junior wrote straight from your post and profile. No separate approach was returned this time.';

    var commentText = data.verified
      ? 'Junior drafted the comment below using that approach and checked it before showing it to you.'
      : 'Junior drafted the comment below using that approach.';

    return { validate: validateText, approach: approachText, comment: commentText };
  }

  function showResult(data) {
    state.comment = data.comment || '';
    state.fallback = Boolean(data.fallback);
    state.verified = Boolean(data.verified);
    state.shouldComment =
      data.qualification && typeof data.qualification.should_comment === 'boolean'
        ? data.qualification.should_comment
        : null;
    state.suggestedAngle =
      (data.qualification && data.qualification.suggested_angle) ||
      data.suggested_angle ||
      '';

    var isSampleOnly = state.fallback || state.shouldComment === false;
    var hasAngle = Boolean(state.suggestedAngle.trim());
    var qual = data.qualification || {};
    var matchReasons = Array.isArray(qual.match_reasons) ? qual.match_reasons : [];

    var result = $('tryit-demo-result');
    var commentBox = $('tryit-demo-comment');
    var commentLabel = $('tryit-comment-label');
    var angleInput = $('tryit-suggested-angle');
    var approachBlock = $('tryit-approach-block');
    var approachHelp = $('tryit-approach-help');
    var regenerateBtn = $('tryit-regenerate-button');
    var fallbackNote = $('tryit-fallback-note');
    var verifiedBadge = $('tryit-verified-badge');
    var resultContext = $('tryit-result-context');
    var whatHappened = $('tryit-what-happened');
    var stepValidate = $('tryit-step-validate-text');
    var stepApproach = $('tryit-step-approach-text');
    var stepComment = $('tryit-step-comment-text');
    var matchReasonsEl = $('tryit-match-reasons');
    var copyButton = $('tryit-copy-comment');
    var successCta = $('tryit-success-cta');

    var steps = buildWhatHappenedSteps(data, isSampleOnly);

    if (whatHappened) whatHappened.hidden = false;
    if (stepValidate) stepValidate.textContent = steps.validate;
    if (stepApproach) stepApproach.textContent = steps.approach;
    if (stepComment) stepComment.textContent = steps.comment;

    if (matchReasonsEl) {
      matchReasonsEl.innerHTML = '';
      if (!isSampleOnly && matchReasons.length) {
        matchReasons.forEach(function (reason) {
          var li = document.createElement('li');
          li.textContent = reason;
          matchReasonsEl.appendChild(li);
        });
        matchReasonsEl.hidden = false;
      } else {
        matchReasonsEl.hidden = true;
      }
    }

    if (commentBox) commentBox.textContent = state.comment;
    if (commentLabel) {
      commentLabel.textContent = isSampleOnly ? 'Example comment' : 'Your comment';
    }
    if (angleInput) angleInput.value = state.suggestedAngle;
    if (approachBlock) approachBlock.hidden = isSampleOnly;
    if (approachHelp) {
      approachHelp.textContent = hasAngle
        ? 'Want a different angle? Edit the approach above and hit regenerate.'
        : 'Add how you would like to connect to this post, then regenerate.';
    }
    if (regenerateBtn) regenerateBtn.hidden = isSampleOnly;

    if (resultContext) {
      if (isSampleOnly) {
        resultContext.hidden = false;
        resultContext.textContent =
          'Try a matched sample hiring post above, then generate again to see real personalization.';
      } else {
        resultContext.hidden = true;
        resultContext.textContent = '';
      }
    }

    if (fallbackNote) fallbackNote.hidden = !isSampleOnly;
    if (verifiedBadge) verifiedBadge.hidden = !(state.verified && !isSampleOnly);
    if (copyButton) copyButton.hidden = isSampleOnly;
    if (successCta) successCta.hidden = isSampleOnly;

    if (result) {
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (!isSampleOnly) {
      persistSignupContext();
      persistLastResult(data);
    }
    updateSignupLinks();

    if (isSampleOnly) {
      track('tryit_fallback_shown', {
        source: 'try-it-page',
        should_comment: state.shouldComment
      });
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
      restoreLastResult();
      showLockout("You've seen how it works. Create your account to generate more comments.", {
        scrollToResult: true
      });
      return;
    }

    readFormIntoState();
    clearError();

    maybeCycleSamplesBeforeGenerate();
    readFormIntoState();

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

      var isSampleOnly =
        Boolean(data.fallback) ||
        (data.qualification && data.qualification.should_comment === false);

      if (!isSampleOnly) {
        setAttempts(getAttempts() + 1);
        updateAttemptsUI();
      }

      showResult(data);
      state.status = isSampleOnly ? 'fallback' : 'success';

      if (isSampleOnly) {
        setError('This demo works on hiring posts. Try a sample or paste a job listing.');
      }

      if (isLockedOut()) {
        showLockout("You've seen how it works. Create your account to generate more comments.", {
          keepFormVisible: true,
          scrollToResult: true
        });
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

  function nextSampleIndex(current, length) {
    return (current + 1) % length;
  }

  function updateSampleButtonLabel() {
    var btn = $('tryit-load-sample');
    if (!btn) return;
    var n = SAMPLE_SCENARIOS.length;
    var next = nextSampleIndex(sampleIndex, n);
    btn.textContent =
      'Try a sample · ' + SAMPLE_SCENARIOS[next].label + ' · ' + (next + 1) + ' of ' + n;
  }

  function applySample(advance) {
    if (advance) sampleIndex = nextSampleIndex(sampleIndex, SAMPLE_SCENARIOS.length);
    var scenario = SAMPLE_SCENARIOS[sampleIndex];
    state.postText = scenario.post;
    state.userBio = scenario.bio;
    syncFormFromState();
    saveDraft();
    updateSampleButtonLabel();
    clearError();
  }

  function maybeCycleSamplesBeforeGenerate() {
    var postEmpty = state.postText.trim().length < 20;
    var bioEmpty = state.userBio.trim().length === 0;

    if (!postEmpty && !bioEmpty) return false;

    if (postEmpty && bioEmpty) {
      applySample(true);
      return true;
    }

    var scenario = SAMPLE_SCENARIOS[sampleIndex];
    if (postEmpty) state.postText = scenario.post;
    if (bioEmpty) state.userBio = scenario.bio;
    syncFormFromState();
    saveDraft();
    return true;
  }

  function loadSample() {
    applySample(true);
  }

  function init() {
    if (!window.DemoCommentClient) return;

    loadDraft();
    syncFormFromState();
    updateSampleButtonLabel();
    updateAttemptsUI();
    updateSignupLinks();

    if (isLockedOut()) {
      restoreLastResult();
      showLockout("You've seen how it works. Create your account to generate more comments.", {
        scrollToResult: true
      });
    }

    var form = $('tryit-demo-form');
    var postInput = $('tryit-post');
    var bioInput = $('tryit-bio');
    var toneInput = $('tryit-tone');
    var regenerateBtn = $('tryit-regenerate-button');
    var copyButton = $('tryit-copy-comment');
    var sampleBtn = $('tryit-load-sample');

    if (sampleBtn) sampleBtn.addEventListener('click', loadSample);

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
