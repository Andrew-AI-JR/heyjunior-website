/**
 * Client for POST /api/comments/demo (marketing try-it flow).
 */
(function () {
  var DEMO_SOURCE = 'try-it-page';

  function DemoRateLimitError(message) {
    this.name = 'DemoRateLimitError';
    this.message = message || 'Rate limit exceeded';
  }
  DemoRateLimitError.prototype = Object.create(Error.prototype);
  DemoRateLimitError.prototype.constructor = DemoRateLimitError;

  function DemoValidationError(message) {
    this.name = 'DemoValidationError';
    this.message = message || 'Invalid request';
  }
  DemoValidationError.prototype = Object.create(Error.prototype);
  DemoValidationError.prototype.constructor = DemoValidationError;

  function parseErrorBody(response, text) {
    if (!text) return null;
    try {
      var json = JSON.parse(text);
      if (json && typeof json.detail === 'string') return json.detail;
      if (json && Array.isArray(json.detail)) {
        return json.detail.map(function (d) {
          return d.msg || d.message || JSON.stringify(d);
        }).join(' ');
      }
      if (json && typeof json.message === 'string') return json.message;
    } catch (_e) {
      /* plain text body */
    }
    return text.trim() || null;
  }

  function buildInitialPayload(state) {
    var payload = {
      post_text: state.postText.trim(),
      tone: state.tone,
      run_qualification: true
    };
    var bio = state.userBio.trim();
    if (bio) payload.user_bio = bio;
    return payload;
  }

  function buildRegeneratePayload(state) {
    var payload = buildInitialPayload(state);
    payload.suggested_angle = state.suggestedAngle.trim();
    payload.run_qualification = false;
    return payload;
  }

  async function generateDemoComment(body, signal) {
    var apiBase = window.getApiBaseUrl();
    var response = await fetch(apiBase + '/api/comments/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ source: DEMO_SOURCE }, body)),
      signal: signal
    });

    var text = await response.text();
    var detail = parseErrorBody(response, text);

    if (response.status === 429) {
      throw new DemoRateLimitError(
        detail || "You've seen how it works. Create your account to generate more comments."
      );
    }

    if (response.status === 422 || response.status === 400) {
      throw new DemoValidationError(detail || 'Invalid input. Check your entries and try again.');
    }

    if (!response.ok) {
      throw new Error(detail || 'Demo failed (' + response.status + ')');
    }

    try {
      return JSON.parse(text);
    } catch (_e) {
      throw new Error('Demo returned an invalid response.');
    }
  }

  window.DemoCommentClient = {
    DemoRateLimitError: DemoRateLimitError,
    DemoValidationError: DemoValidationError,
    buildInitialPayload: buildInitialPayload,
    buildRegeneratePayload: buildRegeneratePayload,
    generateDemoComment: generateDemoComment
  };
})();
