# Reseller Commission System - Technical Specification

## Overview

Automated 20% lifetime commission for resellers using Stripe Connect Express with destination charges. Junior remains Merchant of Record. Commissions are based on net collected revenue.

## Stripe Connect Model

- **Account type**: Express (Stripe-hosted onboarding, Express Dashboard for payout visibility)
- **Charge type**: Destination charges on platform account
- **Fee model**: `application_fee_percent: 80` on subscriptions (platform keeps 80%, reseller receives 20%)
- **Merchant of Record**: Junior platform (responsible for Stripe fees, refunds, chargebacks)

## Stripe API Contract

### Creating a Connected Account (Reseller Onboarding)

```python
# Step 1: Create Express account
account = stripe.Account.create(
    type="express",
    country="US",  # or reseller's country
    email=reseller_email,
    capabilities={
        "transfers": {"requested": True},
    },
    metadata={
        "junior_user_id": str(user_id),
        "referral_code": referral_code,
    },
)
# Store account.id as stripe_connect_account_id on user record

# Step 2: Generate onboarding link
account_link = stripe.AccountLink.create(
    account=account.id,
    refresh_url="https://heyjunior.ai/reseller-dashboard.html?onboarding=refresh",
    return_url="https://heyjunior.ai/reseller-dashboard.html?onboarding=complete",
    type="account_onboarding",
)
# Redirect reseller to account_link.url
```

### Verifying Onboarding Completion

```python
account = stripe.Account.retrieve(stripe_connect_account_id)
is_ready = account.charges_enabled and account.payouts_enabled
# Update reseller_status to "active" if is_ready is True
```

### Creating Checkout Session with Revenue Split

```python
checkout_params = {
    "mode": "subscription",
    "line_items": [{"price": stripe_price_id, "quantity": 1}],
    "success_url": success_url,
    "cancel_url": cancel_url,
}

# Only add split if reseller is active and payout-ready
if reseller_stripe_account_id and reseller_is_active:
    checkout_params["subscription_data"] = {
        "transfer_data": {
            "destination": reseller_stripe_account_id,
        },
        "application_fee_percent": 80,
    }

session = stripe.checkout.Session.create(**checkout_params)
```

### Generating Express Dashboard Login Link

```python
login_link = stripe.Account.create_login_link(stripe_connect_account_id)
# Redirect reseller to login_link.url
```

## Fee Math

| Plan | Monthly Price | Stripe Fee (~2.9% + $0.30) | Net Collected | Platform Keeps (80%) | Reseller Gets (20%) |
|------|--------------|---------------------------|---------------|---------------------|---------------------|
| Standard | $29.99 | ~$1.17 | ~$28.82 | ~$23.06 | ~$5.76 |
| Pro | $49.99 | ~$1.75 | ~$48.24 | ~$38.59 | ~$9.65 |

Note: `application_fee_percent` is calculated on the invoice total before Stripe processing fees. Stripe deducts processing fees from the platform's portion. The reseller receives exactly 20% of the gross invoice amount, and the platform absorbs Stripe fees from its 80%.

Corrected math (application_fee_percent applies to gross):

| Plan | Monthly Price | Reseller Gets (20% of gross) | Platform Gross (80%) | Stripe Fee (~2.9% + $0.30) | Platform Net |
|------|--------------|------------------------------|---------------------|---------------------------|-------------|
| Standard | $29.99 | $6.00 | $23.99 | ~$1.17 | ~$22.82 |
| Pro | $49.99 | $10.00 | $39.99 | ~$1.75 | ~$38.24 |

## Refund Behavior

With destination charges, Stripe automatically reverses transfers proportionally when a refund is issued:
- Full refund: full transfer reversal (reseller commission clawed back)
- Partial refund: proportional transfer reversal

No manual clawback logic needed for refunds -- Stripe handles this natively.

## Dispute Behavior

When a customer disputes a charge:
- The disputed amount is deducted from the platform account
- The transfer to the connected account is NOT automatically reversed
- The platform should handle dispute-related commission adjustments via the commission ledger

## Database Schema Changes

### Users Table (add columns)

```sql
ALTER TABLE users ADD COLUMN is_reseller BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN reseller_status VARCHAR(20) DEFAULT NULL;
  -- Values: 'pending', 'approved', 'onboarding', 'active', 'suspended'
ALTER TABLE users ADD COLUMN stripe_connect_account_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN reseller_onboarded_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN referred_by_reseller_id INTEGER REFERENCES users(id) DEFAULT NULL;
```

### Commission Ledger Table (new)

```sql
CREATE TABLE commission_ledger (
    id SERIAL PRIMARY KEY,
    reseller_id INTEGER NOT NULL REFERENCES users(id),
    subscriber_id INTEGER NOT NULL REFERENCES users(id),
    stripe_invoice_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
      -- Values: 'invoice_paid', 'refund', 'dispute_created', 'dispute_resolved'
    gross_amount INTEGER NOT NULL,        -- in cents
    commission_amount INTEGER NOT NULL,   -- in cents (20% of gross, or negative for clawbacks)
    currency VARCHAR(3) DEFAULT 'usd',
    stripe_transfer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_commission_ledger_reseller ON commission_ledger(reseller_id);
CREATE INDEX idx_commission_ledger_invoice ON commission_ledger(stripe_invoice_id);
```

## API Endpoints

### Reseller Onboarding

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/resellers/onboard` | Bearer token | Create Stripe Express account and return onboarding URL |
| GET | `/api/resellers/onboard/refresh` | Bearer token | Generate fresh onboarding link (if expired/abandoned) |
| GET | `/api/resellers/onboard/return` | Bearer token | Verify account status after onboarding completion |

### Reseller Dashboard Data

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/resellers/dashboard` | Bearer token | Summary: total earned, pending, active subscribers, monthly breakdown |
| GET | `/api/resellers/referrals` | Bearer token | List of referred users (anonymized email, plan, status, signup date) |
| GET | `/api/resellers/stripe-login` | Bearer token | Generate Stripe Express Dashboard login link |

### Modified Existing Endpoints

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/payments/create-checkout-session` | Add `subscription_data.transfer_data` when referred by active reseller |
| GET | `/api/users/me` | Include `is_reseller` and `reseller_status` in response |
| GET | `/api/users/me/referral` | Include `is_reseller` flag in response |

## Webhook Events to Handle

| Event | Action |
|-------|--------|
| `invoice.paid` | Write positive commission_ledger entry |
| `charge.refunded` | Write negative commission_ledger entry (Stripe auto-reverses transfer) |
| `charge.dispute.created` | Write negative commission_ledger entry, flag for review |
| `charge.dispute.closed` | If won, write positive reversal entry |
| `customer.subscription.deleted` | Update referral status tracking |
| `account.updated` | Monitor connected account status changes |

## Reseller Status State Machine

```
[none] -> pending (user requests reseller access)
pending -> approved (admin approves)
approved -> onboarding (Stripe account created, onboarding started)
onboarding -> active (onboarding complete, charges_enabled=true)
active -> suspended (admin action or compliance issue)
suspended -> active (admin reinstates)
```

## Security Considerations

- Reseller dashboard endpoints must verify `is_reseller=true` and `reseller_status='active'`
- Express Dashboard login links are single-use and expire quickly
- Anonymize subscriber emails in referral lists (show `j***@gmail.com` format)
- Commission amounts derived from Stripe events only (no client-supplied values)
- Rate-limit onboarding endpoint to prevent abuse

## Rollout Plan

1. Enable Stripe Connect in dashboard, configure Express branding
2. Deploy backend changes (schema, endpoints, webhooks)
3. Deploy frontend reseller dashboard
4. Pilot with 2-3 existing partners for one billing cycle
5. Validate payout accuracy and reconcile ledger vs Stripe
6. Migrate remaining partners, remove legacy PARTNER_LINKS
