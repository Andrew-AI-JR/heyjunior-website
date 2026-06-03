# Conversion Tracking

This site uses [`js/analytics.js`](../js/analytics.js) as the browser tracking layer. Every event is now sent to a first-party backend sink and also forwarded to vendor pixels when available.

Production backend sink:

```text
POST https://api.heyjunior.ai/api/analytics/events
```

Local backend sink:

```text
POST http://localhost:8080/api/analytics/events
```

## Event source of truth

- `page_view`
  - Fired by the global tracker after `DOMContentLoaded`
  - Trigger: every page that loads [`js/analytics.js`](../js/analytics.js)
  - Payload includes `title`

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

- `landing_jobs_inline_signup_view`
  - Fired in [`js/linkedin-basics-jobs-signup.js`](../js/linkedin-basics-jobs-signup.js)
  - Trigger: inline signup module rendered on [`linkedin-basics-jobs.html`](../linkedin-basics-jobs.html)
  - Payload:
    - `placement`: `hero`

- `landing_jobs_inline_submit_clicked`
  - Fired in [`js/linkedin-basics-jobs-signup.js`](../js/linkedin-basics-jobs-signup.js)
  - Trigger: submit on the inline signup module in [`linkedin-basics-jobs.html`](../linkedin-basics-jobs.html)
  - Payload:
    - `placement`: `hero`

- `landing_jobs_inline_register_completed`
  - Fired in [`js/linkedin-basics-jobs-signup.js`](../js/linkedin-basics-jobs-signup.js)
  - Trigger: successful response from `POST /api/users/register` on the inline landing form
  - Payload:
    - `userId`: backend user id if present

- `landing_jobs_inline_register_error`
  - Fired in [`js/linkedin-basics-jobs-signup.js`](../js/linkedin-basics-jobs-signup.js)
  - Trigger: validation/network/server/duplicate-email errors in inline landing signup
  - Payload:
    - `reason`: `validation`, `duplicate_email`, `timeout`, `network`, or `server`

- `subscription_completed`
  - Fired in [`js/success.js`](../js/success.js)
  - Trigger: only after the success branch where both `data.success` and `data.subscription_active` are true
  - Payload:
    - `source`: `sessionStorage.marketingSource` or `direct`
    - `sessionId`: Stripe session id from the success page URL

- Reddit funnel events
  - Fired in [`reddit.html`](../reddit.html)
  - Important events: `reddit_landing_view`, `reddit_education_step_viewed`, `reddit_money_block_viewed`, `reddit_comment_preview_started`, `reddit_comment_preview_shown`, `reddit_comment_preview_fallback_shown`, `reddit_signup_cta_shown`, `reddit_signup_cta_clicked`, `reddit_output_to_signup_rate`

- Reddit visibility funnel events
  - Fired in [`reddit-visibility.html`](../reddit-visibility.html)
  - Important events: `linkedin_visibility_landing_view`, `linkedin_visibility_hook_viewed`, `linkedin_visibility_demo_block_viewed`, `linkedin_visibility_comment_preview_started`, `linkedin_visibility_comment_preview_shown`, `linkedin_visibility_comment_preview_fallback_shown`, `linkedin_visibility_signup_cta_shown`, `linkedin_visibility_signup_cta_clicked`, `linkedin_visibility_output_to_signup_rate`
  - The page attribution is `data-page="reddit-visibility"` so campaign page views can be segmented separately from the standard Reddit page.

## Core event aliases

The lightweight `/log-event` sink receives simplified funnel names for quick campaign checks:

- `landing_view`
  - Fired on every page that loads [`js/analytics.js`](../js/analytics.js).
- `generate_click`
  - Mapped from `reddit_preview_cta_clicked`, `linkedin_visibility_preview_cta_clicked`, and `register_demo_generate_clicked`.
- `generate_success`
  - Mapped from `reddit_comment_preview_shown`, `reddit_comment_preview_fallback_shown`, `linkedin_visibility_comment_preview_shown`, `linkedin_visibility_comment_preview_fallback_shown`, `register_demo_result_shown`, and `register_demo_fallback_shown`.
- `register_click`
  - Mapped from `reddit_signup_cta_clicked`, `linkedin_visibility_signup_cta_clicked`, `register_submit_clicked`, `landing_jobs_inline_submit_clicked`, and any tracked `cta_click` whose `href` contains `register`.
- `register_success`
  - Mapped from `register_completed` and `landing_jobs_inline_register_completed`.

## Source attribution

- `js/analytics.js` reads `?src=` from the current URL.
- If present, it stores that value in `sessionStorage.marketingSource`.
- UTM params are persisted in `sessionStorage` and sent on all later events in the session.
- Current planned usage:
  - homepage CTAs: direct traffic, no explicit `src`
  - Reddit story page CTA: `register.html?src=reddit-output-cta`
  - Reddit visibility page CTA: `register.html?src=linkedin-visibility-output-cta`
  - blue-collar partner page: `linkedin-basics-jobs.html?src=jobboard-partner`

## Durable event schema

The browser queues events in `localStorage` and posts batches of up to 20 events. Each event has:

- `event_id`: client-generated unique id for dedupe
- `event_name`: event name, for example `reddit_signup_cta_clicked`
- `anonymous_id`: persisted browser id
- `session_id`: per-tab session id
- `user_id`: stored user id when available
- `source`, `page`, `path`, `referrer`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `properties`: event-specific payload
- `user_agent`, `created_at`

The backend persists these into `analytics_events` and ignores duplicate `event_id` values.

## Where scripts are loaded

- [`index.html`](../index.html)
- [`reddit.html`](../reddit.html)
- [`reddit-visibility.html`](../reddit-visibility.html)
- [`register.html`](../register.html)
- [`linkedin-basics-jobs.html`](../linkedin-basics-jobs.html)
- [`success.html`](../success.html)

The Reddit Pixel is active on the key funnel pages with pixel id `a2_ivp2lsryo1gm`. `juniorTrack()` forwards custom events to `rdt` when the pixel global is available.

Each tracked page also contains a pixel-slot comment in `<head>` for Meta / Google / Reddit snippets:

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

4. Confirm the Network tab shows requests to `/api/analytics/events`.
5. You can also listen for the browser event:

```js
window.addEventListener('juniorTrack', (event) => console.log(event.detail));
```

## How to verify each event

### Reddit landing page funnel

- Open [`reddit.html`](../reddit.html) or [`reddit-visibility.html`](../reddit-visibility.html) in an incognito window.
- Confirm the hero and demo are visible before signup.
- Click `Generate my comment`.
- Confirm the generated comment appears with the Junior logo and no login gate.
- Click `Create account -> download app`.
- Confirm [`register.html`](../register.html) opens and focuses the email step.
- In DevTools Console, confirm the simplified events appear during the flow:
  - `landing_view`
  - `generate_click`
  - `generate_success`
  - `register_click`
  - `register_success` after a completed registration when a backend is available
- In DevTools Network, confirm requests are sent to `/api/analytics/events` and `/log-event`.

### CTA clicks

- Open [`index.html`](../index.html), [`reddit.html`](../reddit.html), or [`reddit-visibility.html`](../reddit-visibility.html)
- Click any button with a `data-cta`
- Confirm one `[juniorTrack] cta_click` console entry appears
- Confirm the backend request includes `event_name: "cta_click"`

### Registration

- Requires a working backend API
- Complete a real signup on [`register.html`](../register.html)
- Confirm one `[juniorTrack] register_completed` console entry appears after the successful register response

### Blue-collar inline signup

- Open [`linkedin-basics-jobs.html?src=jobboard-partner`](../linkedin-basics-jobs.html?src=jobboard-partner)
- Confirm the signup module is visible in the hero without extra click-through
- Submit valid signup details directly from the landing page
- Confirm these events appear in Console:
  - `landing_jobs_inline_signup_view`
  - `landing_jobs_inline_submit_clicked`
  - `landing_jobs_inline_register_completed` on success
  - `landing_jobs_inline_register_error` on failed attempt
- Confirm `/log-event` receives `register_click` and `register_success` aliases for the inline flow

### Subscription completion

- Requires a working backend and Stripe test/live flow
- Complete checkout and land on [`success.html`](../success.html) with a valid `session_id`
- Confirm one `[juniorTrack] subscription_completed` entry appears only after the verified success branch

## Backend reporting

Admins can query a basic funnel report:

```text
GET /api/analytics/funnel?source=reddit
Authorization: Bearer <admin token>
```

The response includes event counts and `reddit_output_to_signup_rate`, calculated as:

```text
reddit_signup_cta_clicked / (reddit_comment_preview_shown + reddit_comment_preview_fallback_shown)
```

Useful SQL for direct database checks:

```sql
select event_name, count(*)
from analytics_events
where created_at >= now() - interval '24 hours'
group by event_name
order by count(*) desc;
```

```sql
select
  count(*) filter (where event_name in ('reddit_comment_preview_shown', 'reddit_comment_preview_fallback_shown')) as previews,
  count(*) filter (where event_name = 'reddit_signup_cta_clicked') as signup_clicks
from analytics_events
where source = 'reddit'
  and created_at >= now() - interval '7 days';
```

## Important limitation

Stripe webhook health is not verifiable from this frontend repo. Check Stripe Dashboard directly for webhook delivery status and failures.
