# Two-Level Commission System - Technical Specification

## Overview

Junior pays two recurring commissions for reseller-sourced subscriptions:

- **Reseller commission**: 20% of net collected subscription revenue.
- **Salesperson commission**: 20% of net collected subscription revenue for subscribers sourced by resellers that salesperson onboarded.

Junior remains Merchant of Record and controls customer refunds, credits, and disputes. Commissionable revenue is calculated after Stripe processing fees, taxes, refunds, credits, and chargebacks.

## Stripe Connect Model

- **Account type**: Stripe Connect Express for resellers and salespeople.
- **Charge type**: Platform charges owned by Junior.
- **Payout model**: Manual `stripe.Transfer.create()` calls from `invoice.paid` webhooks.
- **Do not use**: `subscription_data.transfer_data.destination` or `application_fee_percent` for new subscriptions.
- **Merchant of Record**: Junior platform.
- **Refund owner**: Junior decides and processes refunds; commission transfers are reversed proportionally.

## Stripe API Contract

### Creating a Connected Account (Reseller or Salesperson Onboarding)

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
# Store account.id as stripe_connect_account_id or salesperson_stripe_connect_account_id

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

### Creating Checkout Session with Attribution Metadata

```python
checkout_params = {
    "mode": "subscription",
    "line_items": [{"price": stripe_price_id, "quantity": 1}],
    "success_url": success_url,
    "cancel_url": cancel_url,
    "subscription_data": {
        "metadata": {
            "reseller_id": str(reseller_id),
            "salesperson_id": str(salesperson_id) if salesperson_id else "",
        },
    },
}

session = stripe.checkout.Session.create(**checkout_params)
```

### Generating Express Dashboard Login Link

```python
login_link = stripe.Account.create_login_link(stripe_connect_account_id)
# Redirect reseller to login_link.url
```

## Fee Math

Commission base:

```text
net_commission_base = invoice.amount_paid - stripe_fee_amount - tax_amount
```

Approximate monthly examples:

| Plan | Monthly Price | Stripe Fee (~2.9% + $0.30) | Net Commission Base | Reseller 20% | Salesperson 20% | Junior Net |
|------|--------------|----------------------------|---------------------|--------------|-----------------|------------|
| Standard | $29.99 | ~$1.17 | ~$28.82 | ~$5.76 | ~$5.76 | ~$17.30 |
| Pro | $49.99 | ~$1.75 | ~$48.24 | ~$9.65 | ~$9.65 | ~$28.94 |

If there is no salesperson for a reseller-sourced subscriber, only the reseller commission is paid and Junior keeps the remaining net revenue.

## Refund Behavior

Because commissions are paid with manual transfers, Stripe does not automatically reverse commissions. The backend must reverse transfers proportionally when a refund, credit, chargeback, or lost dispute reduces retained revenue.

- Full refund: full commission reversal for reseller and salesperson.
- Partial refund: proportional commission reversal.
- Chargeback/lost dispute: reverse related commissions and record dispute metadata.

## Dispute Behavior

When a customer disputes a charge:

- Junior owns the dispute process.
- Commission ledger rows are marked for review immediately.
- If the dispute is lost, reverse reseller and salesperson transfers proportionally.
- If the dispute is won, restore or leave commissions in place depending on whether a temporary reversal was already created.

## Database Schema Changes

### Users Table (add columns)

```sql
ALTER TABLE users ADD COLUMN is_reseller BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN reseller_status VARCHAR(20) DEFAULT NULL;
  -- Values: 'pending', 'approved', 'onboarding', 'active', 'suspended'
ALTER TABLE users ADD COLUMN stripe_connect_account_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN reseller_onboarded_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN referred_by_reseller_id INTEGER REFERENCES users(id) DEFAULT NULL;
ALTER TABLE users ADD COLUMN is_salesperson BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN salesperson_status VARCHAR(20) DEFAULT NULL;
  -- Values: 'pending', 'onboarding', 'active', 'suspended'
ALTER TABLE users ADD COLUMN salesperson_stripe_connect_account_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN salesperson_onboarded_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN reseller_onboarded_by_salesperson_id INTEGER REFERENCES users(id) DEFAULT NULL;
```

### Commission Ledger Table (new)

```sql
CREATE TABLE commission_ledger (
    id SERIAL PRIMARY KEY,
    recipient_user_id INTEGER NOT NULL REFERENCES users(id),
    recipient_role VARCHAR(20) NOT NULL,
      -- Values: 'reseller', 'salesperson'
    subscriber_id INTEGER NOT NULL REFERENCES users(id),
    stripe_invoice_id VARCHAR(255) NOT NULL,
    stripe_event_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
      -- Values: 'invoice_paid', 'refund', 'dispute_created', 'dispute_resolved'
    gross_invoice_amount INTEGER NOT NULL,
    stripe_fee_amount INTEGER NOT NULL,
    tax_amount INTEGER DEFAULT 0,
    net_commission_base INTEGER NOT NULL,
    commission_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    commission_amount INTEGER NOT NULL,   -- positive for payouts, negative for clawbacks
    currency VARCHAR(3) DEFAULT 'usd',
    stripe_transfer_id VARCHAR(255),
    transfer_status VARCHAR(20) DEFAULT 'pending',
      -- Values: 'pending', 'completed', 'failed', 'reversed', 'abandoned'
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_commission_ledger_recipient ON commission_ledger(recipient_user_id, recipient_role);
CREATE INDEX idx_commission_ledger_invoice ON commission_ledger(stripe_invoice_id);
CREATE UNIQUE INDEX idx_commission_ledger_invoice_paid_recipient
  ON commission_ledger(stripe_invoice_id, recipient_user_id, recipient_role)
  WHERE event_type = 'invoice_paid';
CREATE UNIQUE INDEX idx_commission_ledger_event_recipient
  ON commission_ledger(stripe_event_id, recipient_user_id, recipient_role)
  WHERE stripe_event_id IS NOT NULL;
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

### Salesperson Onboarding and Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/salespeople/onboard` | Admin | Create Stripe Express account and return onboarding URL |
| GET | `/api/salespeople/dashboard` | Bearer token | Summary: total earned, monthly breakdown, resellers onboarded |
| GET | `/api/salespeople/resellers` | Bearer token | List resellers onboarded by salesperson |
| GET | `/api/salespeople/stripe-login` | Bearer token | Generate Stripe Express Dashboard login link |

### Modified Existing Endpoints

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/payments/create-checkout-session` | Add reseller/salesperson metadata to subscription; do not add `transfer_data` |
| GET | `/api/users/me` | Include reseller and salesperson status fields |
| GET | `/api/users/me/referral` | Include `is_reseller` flag in response |

## Webhook Events to Handle

| Event | Action |
|-------|--------|
| `invoice.paid` | Fetch balance transaction, calculate net commission base, create transfers, write positive ledger rows |
| `charge.refunded` | Reverse transfers proportionally and write negative ledger rows |
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

## Salesperson Status State Machine

```
[none] -> pending (admin creates salesperson)
pending -> onboarding (Stripe account created, onboarding started)
onboarding -> active (onboarding complete, payouts_enabled=true)
active -> suspended (admin action or compliance issue)
suspended -> active (admin reinstates)
```

## Security Considerations

- Reseller dashboard endpoints must verify `is_reseller=true` and `reseller_status='active'`
- Express Dashboard login links are single-use and expire quickly
- Anonymize subscriber emails in referral lists (show `j***@gmail.com` format)
- Commission amounts derived from Stripe events and balance transactions only (no client-supplied values)
- Rate-limit onboarding endpoint to prevent abuse

## Migration from Existing Auto-Split Subscriptions

For every active subscription that currently has `transfer_data.destination` and `application_fee_percent`:

1. Look up the reseller by `stripe_connect_account_id`.
2. Stamp subscription metadata with `reseller_id` and `salesperson_id` (if present).
3. Remove `transfer_data` and `application_fee_percent`.
4. Record migration status in an audit table.

Run during a quiet billing window to avoid double-payment risk.

## Rollout Plan

1. Enable Stripe Connect in dashboard, configure Express branding
2. Deploy schema changes and new commission ledger
3. Deploy reseller and salesperson Connect onboarding endpoints
4. Deploy checkout metadata changes without enabling transfers
5. Deploy `invoice.paid` and refund reversal webhooks
6. Migrate existing auto-split subscriptions to metadata/manual-transfer model
7. Pilot with 2-3 resellers and at least one salesperson for one billing cycle
8. Validate payout accuracy and reconcile ledger vs Stripe transfers
