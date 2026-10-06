# Promo and Coupon Links

Quick reference for all active checkout links and their coupon codes.

---

## Normal Signup (all visitors)

No coupon is applied. New signups get the standard Stripe trial (card collected at signup).

| Link | Coupon | Offer |
|------|--------|-------|
| `https://heyjunior.ai/register.html` | -- | Standard trial, card required |
| `https://heyjunior.ai/register.html?plan=basic` | -- | Pre-selects Basic plan |
| `https://heyjunior.ai/register.html?plan=starter` | -- | Pre-selects Starter plan |
| `https://heyjunior.ai/register.html?plan=standard` | -- | Pre-selects Standard plan |
| `https://heyjunior.ai/register.html?plan=pro` | -- | Pre-selects Pro plan |

---

## 50% Off LinkedIn Campaign

| Link | Coupon | Offer |
|------|--------|-------|
| `https://heyjunior.ai/50off/` | `JUNIOR50` (auto-applied) | 50% off for 3 months |
| `https://heyjunior.ai/50off/?plan=basic` | `JUNIOR50` | Pre-selects Basic |
| `https://heyjunior.ai/50off/?plan=starter` | `JUNIOR50` | Pre-selects Starter |
| `https://heyjunior.ai/50off/?plan=basic` | `JUNIOR50` | Pre-selects Basic |
| `https://heyjunior.ai/50off/?plan=starter` | `JUNIOR50` | Pre-selects Starter |
| `https://heyjunior.ai/50off/?plan=standard` | `JUNIOR50` | Pre-selects Standard |
| `https://heyjunior.ai/50off/?plan=pro` | `JUNIOR50` | Pre-selects Pro |

Tagged version for LinkedIn post tracking:
```
https://heyjunior.ai/50off/?src=linkedin-post&utm_source=linkedin&utm_medium=organic&utm_campaign=50off_3months
```

---

## Qualified Applicants (Veterans, Disabled, etc.) -- Private

These links are NOT published anywhere on the site. Share only via direct email after qualification.

| Link | Coupon | Offer |
|------|--------|-------|
| `https://heyjunior.ai/free/` | `3FREEMONTHS` (auto-applied) | 3 months completely free |
| `https://heyjunior.ai/free/?plan=basic` | `3FREEMONTHS` | Pre-selects Basic |
| `https://heyjunior.ai/free/?plan=starter` | `3FREEMONTHS` | Pre-selects Starter |
| `https://heyjunior.ai/free/?plan=basic` | `3FREEMONTHS` | Pre-selects Basic |
| `https://heyjunior.ai/free/?plan=starter` | `3FREEMONTHS` | Pre-selects Starter |
| `https://heyjunior.ai/free/?plan=standard` | `3FREEMONTHS` | Pre-selects Standard |
| `https://heyjunior.ai/free/?plan=pro` | `3FREEMONTHS` | Pre-selects Pro |

Quick link alternative (uses normal register page with coupon override):
```
https://heyjunior.ai/register.html?coupon=3FREEMONTHS
```

---

## CareerBridgeIQ Partnership (30-Day Job Search Accelerator)

Co-branded landing page with an embedded signup form. Attribution is recorded in the signup `metadata` (`signup_source`, `source`, and all `utm_*`) via `/api/users/create-with-payment`, not via a unique coupon. Cohort is keyed on `metadata.signup_source = "careerbridgeiq-partner"`.

| Link | Coupon | Offer |
|------|--------|-------|
| `https://heyjunior.ai/careerbridgeiq/` | -- | 30-day Stripe trial (keyed on `signup_source`) |
| `https://heyjunior.ai/careerbridgeiq/?plan=basic` | -- | Pre-selects Basic |
| `https://heyjunior.ai/careerbridgeiq/?plan=starter` | -- | Pre-selects Starter |
| `https://heyjunior.ai/careerbridgeiq/?plan=standard` | -- | Pre-selects Standard |
| `https://heyjunior.ai/careerbridgeiq/?plan=pro` | -- | Pre-selects Pro |

UTM scheme for all placements: `utm_source=careerbridgeiq`, `utm_medium=partner`, `utm_campaign=30day`, and a per-placement `utm_content` (`landing-page`, `email`, `community-article`, `matt-linkedin`, `partner-page`).

Canonical tracked link (landing-page placement):
```
https://heyjunior.ai/careerbridgeiq/?utm_source=careerbridgeiq&utm_medium=partner&utm_campaign=30day&utm_content=landing-page
```

Partner copy assets (trial-page section, email, community article, Matt's LinkedIn posts, permanent partner page, and the full tracking-link list) live in `campaign-assets/careerbridgeiq/`.

---

## Junior 3.0 Launch -- Enterprise Offer

One month of Enterprise free, starting when you claim it, then $99/month. A card is required, and the subscription can be cancelled any time from the billing portal. The coupon is 100% off for one month (`duration: once`) and is restricted to the Enterprise product only -- it does not apply to Basic, Starter, Standard, or Pro. Window is seven days, closing **September 9, 2026**.

| Link | Coupon | Offer |
|------|--------|-------|
| `https://heyjunior.ai/junior-3.html` | -- | Launch page (what shipped in 3.0 plus the offer) |
| `https://heyjunior.ai/register.html?plan=enterprise&coupon=JUNIOR3ENT` | `JUNIOR3ENT` | First month of Enterprise free, then $99/month |

Canonical tracked conversion link (launch page placement):
```
https://heyjunior.ai/register.html?plan=enterprise&coupon=JUNIOR3ENT&src=junior3-launch-page
```

Channel values for `?src=` on either URL: `email-launch`, `email-offer`, `producthunt`, `linkedin`, `linkedin-company`, `x`, `hn`, `indiehackers`, `github`. On-site placements use `home-announcement`, `home-pricing-enterprise-offer`, and `junior3-launch-page`.

Downloads always resolve to the current release; never link a pinned tag:
```
https://github.com/Andrew-AI-JR/Desktop-Releases/releases/latest
```

Customers with an active paid subscription upgrade through the in-app Stripe Billing Portal flow instead, where the discount is attached server-side from an allowlist. Customers already on Enterprise and customers currently in a trial are excluded from the offer.

---

## Custom Coupon via URL

Any **active Stripe promotion code** can be applied to the normal register flow by appending `?coupon=CODE`:
```
https://heyjunior.ai/register.html?coupon=YOUR_PROMO_CODE
```
The API only accepts active promotion codes. Coupon names and raw coupon IDs are rejected, except for the server-side cancellation offer code (`CANCELLATION_OFFER_CODE` -> `CANCELLATION_OFFER_STRIPE_COUPON_ID`) and IDs listed in `ALLOWED_DIRECT_COUPON_IDS`. To launch a new offer, create a promotion code in Stripe, ideally with an expiry or `max_redemptions`.

---

## Stripe Coupon Codes Reference

| Code | Stripe Promo ID | Offer | Used On |
|------|-----------------|-------|---------|
| `JUNIOR50` | `promo_1TT14bRxE6F23RwQqyQUg5X0` (inactive, expired) | 50% off for 3 months | `/50off/` landing page |
| `3FREEMONTHS` | `promo_1TaIX0RxE6F23RwQxkpABoOm` | 100% off for 3 months | `/free/` landing page, private email links |
| `WINBACK` | server-mapped to coupon `sw5J3M9U` | 100% off next invoice (`duration: once`) | Cancellation win-back email |
| `JUNIOR3ENT` | (check Stripe dashboard) | 100% off the first month of Enterprise only, `duration: once`, closes September 9, 2026 | `junior-3.html`, Junior 3.0 launch emails |

---

## Stripe Price IDs

| Plan | Price ID | Monthly Price | Comments/day |
|------|----------|---------------|--------------|
| Basic | `price_1TcWzqRxE6F23RwQ7FnKpQyU` | $9.99 | 10 |
| Starter | `price_1TqD2LRxE6F23RwQg0S18fTb` | $14.99 | 20 |
| Standard | `price_1RJMCrRxE6F23RwQEnHUwvFq` | $29.99 | 50 |
| Pro | `price_1SX1LrRxE6F23RwQgWgIV1NK` | $49.99 | 80 |
| Enterprise | `price_1U9pPSRxE6F23RwQnxbshVb5` | $99 | 80, plus commenting as your LinkedIn company page |
