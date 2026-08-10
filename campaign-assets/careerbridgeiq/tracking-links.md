# CareerBridgeIQ Partnership - Tracking Links

All CareerBridgeIQ traffic should land on the co-branded page:

```
https://heyjunior.ai/careerbridgeiq/
```

Base UTM scheme for the campaign:

| Parameter | Value |
|-----------|-------|
| `utm_source` | `careerbridgeiq` |
| `utm_medium` | `partner` |
| `utm_campaign` | `30day` |
| `utm_content` | varies per placement (see below) |

Attribution note: the `/careerbridgeiq/` signup form records `source` and all `utm_*` values into the signup `metadata` (via `create-with-payment`), and the analytics pipeline also records them on page views and CTA clicks. Cohort attribution is keyed on `metadata.signup_source = "careerbridgeiq-partner"`.

## Per-placement links (copy/paste)

### 1. 30-Day Trial landing page section
```
https://heyjunior.ai/careerbridgeiq/?utm_source=careerbridgeiq&utm_medium=partner&utm_campaign=30day&utm_content=landing-page
```

### 2. Partner email (Day 4-7)
```
https://heyjunior.ai/careerbridgeiq/?utm_source=careerbridgeiq&utm_medium=partner&utm_campaign=30day&utm_content=email
```

### 3. Community article
```
https://heyjunior.ai/careerbridgeiq/?utm_source=careerbridgeiq&utm_medium=partner&utm_campaign=30day&utm_content=community-article
```

### 4. Matt's LinkedIn posts
```
https://heyjunior.ai/careerbridgeiq/?utm_source=careerbridgeiq&utm_medium=partner&utm_campaign=30day&utm_content=matt-linkedin
```
(For A/B testing individual posts, append a suffix: `matt-linkedin-1`, `matt-linkedin-2`, etc.)

### 5. Permanent partner/resource page
```
https://heyjunior.ai/careerbridgeiq/?utm_source=careerbridgeiq&utm_medium=partner&utm_campaign=30day&utm_content=partner-page
```

## Plan pre-selection (optional)

Append `&plan=basic|starter|standard|pro` to pre-select a plan. Standard is selected by default.

```
https://heyjunior.ai/careerbridgeiq/?plan=standard&utm_source=careerbridgeiq&utm_medium=partner&utm_campaign=30day&utm_content=landing-page
```

## Offer

- Coupon applied automatically on this page: `1FREEMONTH` (first 30 days free, card required, cancel anytime).
- No separate code for members to enter - the offer is baked into the `/careerbridgeiq/` page.
