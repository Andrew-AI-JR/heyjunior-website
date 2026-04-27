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

- `subscription_completed`
  - Fired in [`js/success.js`](../js/success.js)
  - Trigger: only after the success branch where both `data.success` and `data.subscription_active` are true
  - Payload:
    - `source`: `sessionStorage.marketingSource` or `direct`
    - `sessionId`: Stripe session id from the success page URL

- Reddit funnel events
  - Fired in [`reddit.html`](../reddit.html)
  - Important events: `reddit_landing_view`, `reddit_education_step_viewed`, `reddit_money_block_viewed`, `reddit_comment_preview_started`, `reddit_comment_preview_shown`, `reddit_comment_preview_fallback_shown`, `reddit_signup_cta_shown`, `reddit_signup_cta_clicked`, `reddit_output_to_signup_rate`

## Source attribution

- `js/analytics.js` reads `?src=` from the current URL.
- If present, it stores that value in `sessionStorage.marketingSource`.
- UTM params are persisted in `sessionStorage` and sent on all later events in the session.
- Current planned usage:
  - homepage CTAs: direct traffic, no explicit `src`
  - paid landing page CTAs: `register.html?src=reddit`

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
- [`register.html`](../register.html)
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

### CTA clicks

- Open [`index.html`](../index.html) or [`reddit.html`](../reddit.html)
- Click any button with a `data-cta`
- Confirm one `[juniorTrack] cta_click` console entry appears
- Confirm the backend request includes `event_name: "cta_click"`

### Registration

- Requires a working backend API
- Complete a real signup on [`register.html`](../register.html)
- Confirm one `[juniorTrack] register_completed` console entry appears after the successful register response

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
