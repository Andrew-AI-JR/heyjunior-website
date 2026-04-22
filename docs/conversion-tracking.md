# Conversion Tracking

This site now exposes a small front-end tracking helper in [`js/analytics.js`](../js/analytics.js).

## Event source of truth

- `cta_click`
  - Fired by the global click listener in [`js/analytics.js`](../js/analytics.js)
  - Trigger: any click on an element with a `data-cta` attribute
  - Payload:
    - `source`: `sessionStorage.marketingSource` or `direct`
    - `location`: the `data-cta` value
    - `href`: destination URL

- `register_completed`
  - Fired in [`js/register.js`](../js/register.js)
  - Trigger: successful response from `POST /api/users/register`
  - Payload:
    - `source`: `sessionStorage.marketingSource` or `direct`
    - `userId`: backend user id if present

- `subscription_completed`
  - Fired in [`js/success.js`](../js/success.js)
  - Trigger: only after the success branch where both `data.success` and `data.subscription_active` are true
  - Payload:
    - `source`: `sessionStorage.marketingSource` or `direct`
    - `sessionId`: Stripe session id from the success page URL

## Source attribution

- `js/analytics.js` reads `?src=` from the current URL.
- If present, it stores that value in `sessionStorage.marketingSource`.
- Current planned usage:
  - homepage CTAs: direct traffic, no explicit `src`
  - paid landing page CTAs: `register.html?src=reddit`

## Where scripts are loaded

- [`index.html`](../index.html)
- [`reddit.html`](../reddit.html)
- [`register.html`](../register.html)
- [`success.html`](../success.html)

Each tracked page also contains a pixel-slot comment in `<head>` for future Meta / Google / Reddit snippets:

```html
<!-- Pixel slot: insert Meta / Google / Reddit pixel snippets here. juniorTrack() forwards events only when those globals exist. -->
```

## How to verify locally

1. Serve the site locally, for example:

```bash
python -m http.server 8000
```

2. Open the page in a browser.
3. Watch the browser console for entries in this format:

```text
[juniorTrack] event_name { ...payload }
```

4. You can also listen for the browser event:

```js
window.addEventListener('juniorTrack', (event) => console.log(event.detail));
```

## How to verify each event

### CTA clicks

- Open [`index.html`](../index.html) or [`reddit.html`](../reddit.html)
- Click any button with a `data-cta`
- Confirm one `[juniorTrack] cta_click` console entry appears

### Registration

- Requires a working backend API
- Complete a real signup on [`register.html`](../register.html)
- Confirm one `[juniorTrack] register_completed` console entry appears after the successful register response

### Subscription completion

- Requires a working backend and Stripe test/live flow
- Complete checkout and land on [`success.html`](../success.html) with a valid `session_id`
- Confirm one `[juniorTrack] subscription_completed` entry appears only after the verified success branch

## Important limitation

This front-end repo only adds instrumentation hooks and QA-visible logs/events. Actual CPA reporting still requires at least one verified analytics sink:

- confirmed vendor pixels installed and receiving events, or
- confirmed Cloudflare custom-event support if added later

Stripe webhook health is not verifiable from this repo. Check Stripe Dashboard directly for webhook delivery status and failures.
