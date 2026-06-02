# Promo and Coupon Links

Quick reference for all active checkout links and their coupon codes.

---

## Normal Signup (all visitors)

| Link | Coupon | Offer |
|------|--------|-------|
| `https://heyjunior.ai/register.html` | `1FREEMONTH` (auto-applied) | First month free, card required |
| `https://heyjunior.ai/register.html?plan=basic` | `1FREEMONTH` | Pre-selects Basic plan |
| `https://heyjunior.ai/register.html?plan=starter` | `1FREEMONTH` | Pre-selects Starter plan |
| `https://heyjunior.ai/register.html?plan=basic` | `1FREEMONTH` | Pre-selects Basic plan |
| `https://heyjunior.ai/register.html?plan=starter` | `1FREEMONTH` | Pre-selects Starter plan |
| `https://heyjunior.ai/register.html?plan=standard` | `1FREEMONTH` | Pre-selects Standard plan |
| `https://heyjunior.ai/register.html?plan=pro` | `1FREEMONTH` | Pre-selects Pro plan |

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

## Custom Coupon via URL

Any Stripe coupon can be applied to the normal register flow by appending `?coupon=CODE`:
```
https://heyjunior.ai/register.html?coupon=YOUR_COUPON_CODE
```
If no `?coupon=` is provided, the default `1FREEMONTH` is applied.

---

## Stripe Coupon Codes Reference

| Code | Stripe Promo ID | Offer | Used On |
|------|-----------------|-------|---------|
| `1FREEMONTH` | (check Stripe dashboard) | 100% off first month | Normal register flow |
| `JUNIOR50` | `promo_1TT14bRxE6F23RwQqyQUg5X0` | 50% off for 3 months | `/50off/` landing page |
| `3FREEMONTHS` | (check Stripe dashboard) | 100% off for 3 months | `/free/` landing page, private email links |

---

## Stripe Price IDs

| Plan | Price ID | Monthly Price | Comments/day |
|------|----------|---------------|--------------|
| Basic | `price_1TcWzqRxE6F23RwQ7FnKpQyU` | $9.99 | 10 |
| Starter | `price_1TcX0nRxE6F23RwQpZxnoTRv` | $14.99 | 20 |
| Standard | `price_1RJMCrRxE6F23RwQEnHUwvFq` | $29.99 | 50 |
| Pro | `price_1SX1LrRxE6F23RwQgWgIV1NK` | $49.99 | 80 |
