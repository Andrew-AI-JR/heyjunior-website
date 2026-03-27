# Reseller Backend Implementation Guide

This document provides complete implementation details for the backend (`api.heyjunior.ai`) to support the automated reseller commission system using Stripe Connect Express.

## Prerequisites

1. Enable **Stripe Connect** in Stripe Dashboard > Settings > Connect
2. Configure Express branding (platform name, icon, colors)
3. Install/update `stripe` Python package (ensure >= 5.0)
4. Set environment variables:
   - `STRIPE_CONNECT_WEBHOOK_SECRET` (for Connect webhook endpoint)
   - Existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` remain

---

## Phase 1: Database Schema & Referral Attribution

### Schema Migrations

```sql
-- Migration: add_reseller_fields_to_users
ALTER TABLE users ADD COLUMN is_reseller BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN reseller_status VARCHAR(20) DEFAULT NULL
  CHECK (reseller_status IN ('pending', 'approved', 'onboarding', 'active', 'suspended'));
ALTER TABLE users ADD COLUMN stripe_connect_account_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN reseller_onboarded_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN referred_by_reseller_id INTEGER REFERENCES users(id) DEFAULT NULL;

CREATE INDEX idx_users_reseller_status ON users(reseller_status) WHERE is_reseller = TRUE;
CREATE INDEX idx_users_referred_by ON users(referred_by_reseller_id) WHERE referred_by_reseller_id IS NOT NULL;
```

```sql
-- Migration: create_commission_ledger
CREATE TABLE commission_ledger (
    id SERIAL PRIMARY KEY,
    reseller_id INTEGER NOT NULL REFERENCES users(id),
    subscriber_id INTEGER NOT NULL REFERENCES users(id),
    stripe_invoice_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL
      CHECK (event_type IN ('invoice_paid', 'refund', 'dispute_created', 'dispute_resolved')),
    gross_amount INTEGER NOT NULL,
    commission_amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    stripe_transfer_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_commission_ledger_reseller ON commission_ledger(reseller_id);
CREATE INDEX idx_commission_ledger_invoice ON commission_ledger(stripe_invoice_id);
CREATE INDEX idx_commission_ledger_created ON commission_ledger(created_at);
```

### Registration Endpoint Changes

Update `POST /api/users/register` to persist `referred_by_reseller_id`:

```python
# In the registration handler, after creating the user:
if request.referral_code:
    referrer = db.query(User).filter(
        User.referral_code == request.referral_code.upper(),
        User.is_reseller == True,
        User.reseller_status == 'active'
    ).first()
    
    if referrer:
        new_user.referred_by_reseller_id = referrer.id
        db.commit()
        logger.info(f"User {new_user.id} attributed to reseller {referrer.id}")
    else:
        # Still store as regular referral even if referrer is not an active reseller
        # The referral_code is already stored via existing logic
        pass
```

### User Response Schema Update

Add to the `GET /api/users/me` response:

```python
class UserResponse(BaseModel):
    # ... existing fields ...
    is_reseller: bool = False
    reseller_status: Optional[str] = None
```

And to `GET /api/users/me/referral`:

```python
class ReferralResponse(BaseModel):
    referral_code: Optional[str]
    referrals_count: int
    is_reseller: bool = False
    reseller_status: Optional[str] = None
```

---

## Phase 2: Stripe Connect Onboarding Endpoints

### POST /api/resellers/onboard

Creates a Stripe Express connected account and returns the onboarding URL.

```python
@router.post("/api/resellers/onboard")
async def reseller_onboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Guard: user must be approved for reseller program
    if not current_user.is_reseller:
        raise HTTPException(400, "You are not enrolled in the reseller program. Contact support to apply.")
    
    if current_user.reseller_status not in ('approved', 'onboarding'):
        if current_user.reseller_status == 'active':
            raise HTTPException(400, "You are already onboarded as a reseller.")
        if current_user.reseller_status == 'suspended':
            raise HTTPException(403, "Your reseller account is suspended. Contact support.")
        raise HTTPException(400, f"Cannot onboard with current status: {current_user.reseller_status}")
    
    try:
        # Create Express account if not already created
        if not current_user.stripe_connect_account_id:
            account = stripe.Account.create(
                type="express",
                email=current_user.email,
                capabilities={"transfers": {"requested": True}},
                metadata={
                    "junior_user_id": str(current_user.id),
                    "referral_code": current_user.referral_code,
                },
            )
            current_user.stripe_connect_account_id = account.id
            current_user.reseller_status = 'onboarding'
            db.commit()
        
        # Generate onboarding link
        account_link = stripe.AccountLink.create(
            account=current_user.stripe_connect_account_id,
            refresh_url=f"{FRONTEND_URL}/reseller-dashboard.html?onboarding=refresh",
            return_url=f"{FRONTEND_URL}/reseller-dashboard.html?onboarding=complete",
            type="account_onboarding",
        )
        
        return {"onboarding_url": account_link.url}
    
    except stripe.error.StripeError as e:
        logger.error(f"Stripe Connect error for user {current_user.id}: {e}")
        raise HTTPException(500, "Failed to set up reseller account. Please try again.")
```

### GET /api/resellers/onboard/refresh

Generates a fresh onboarding link (for expired/abandoned flows).

```python
@router.get("/api/resellers/onboard/refresh")
async def reseller_onboard_refresh(current_user: User = Depends(get_current_user)):
    if not current_user.stripe_connect_account_id:
        raise HTTPException(400, "No reseller account found. Start onboarding first.")
    
    account_link = stripe.AccountLink.create(
        account=current_user.stripe_connect_account_id,
        refresh_url=f"{FRONTEND_URL}/reseller-dashboard.html?onboarding=refresh",
        return_url=f"{FRONTEND_URL}/reseller-dashboard.html?onboarding=complete",
        type="account_onboarding",
    )
    
    return {"onboarding_url": account_link.url}
```

### GET /api/resellers/onboard/return

Verifies account status after onboarding completion.

```python
@router.get("/api/resellers/onboard/return")
async def reseller_onboard_return(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.stripe_connect_account_id:
        raise HTTPException(400, "No reseller account found.")
    
    account = stripe.Account.retrieve(current_user.stripe_connect_account_id)
    
    is_ready = account.charges_enabled and account.payouts_enabled
    
    if is_ready and current_user.reseller_status != 'active':
        current_user.reseller_status = 'active'
        current_user.reseller_onboarded_at = datetime.utcnow()
        db.commit()
    
    return {
        "status": current_user.reseller_status,
        "charges_enabled": account.charges_enabled,
        "payouts_enabled": account.payouts_enabled,
        "details_submitted": account.details_submitted,
    }
```

---

## Phase 3: Checkout Session Split Logic

### Modify POST /api/payments/create-checkout-session

```python
@router.post("/api/payments/create-checkout-session")
async def create_checkout_session(request: CheckoutRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    checkout_params = {
        "mode": "subscription",
        "line_items": [{"price": request.price_id, "quantity": 1}],
        "success_url": request.success_url,
        "cancel_url": request.cancel_url,
        "customer": current_user.stripe_customer_id,
        # ... existing params (metadata, coupon, etc.) ...
    }
    
    # Apply reseller revenue split if applicable
    reseller_split = _resolve_reseller_split(current_user, db)
    if reseller_split:
        checkout_params["subscription_data"] = {
            "transfer_data": {
                "destination": reseller_split["stripe_connect_account_id"],
            },
            "application_fee_percent": 80,  # Platform keeps 80%, reseller gets 20%
        }
        # Store reseller attribution in subscription metadata
        checkout_params.setdefault("subscription_data", {})
        checkout_params["subscription_data"]["metadata"] = {
            "reseller_id": str(reseller_split["reseller_id"]),
            "reseller_code": reseller_split["referral_code"],
        }
    
    try:
        session = stripe.checkout.Session.create(**checkout_params)
        return {"checkout_url": session.url}
    except stripe.error.StripeError as e:
        # NON-BLOCKING FALLBACK: If split fails, retry without split
        if reseller_split and "transfer_data" in str(e):
            logger.error(f"Split failed for reseller {reseller_split['reseller_id']}, falling back to no-split checkout: {e}")
            # Alert ops team (email/Slack notification)
            _alert_split_failure(current_user.id, reseller_split["reseller_id"], str(e))
            
            checkout_params.pop("subscription_data", None)
            session = stripe.checkout.Session.create(**checkout_params)
            return {"checkout_url": session.url}
        raise HTTPException(500, "Failed to create checkout session.")


def _resolve_reseller_split(user: User, db: Session) -> Optional[dict]:
    """Check if this user was referred by an active reseller with a valid connected account."""
    if not user.referred_by_reseller_id:
        return None
    
    reseller = db.query(User).filter(
        User.id == user.referred_by_reseller_id,
        User.is_reseller == True,
        User.reseller_status == 'active',
        User.stripe_connect_account_id.isnot(None),
    ).first()
    
    if not reseller:
        return None
    
    # Verify connected account is payout-ready
    try:
        account = stripe.Account.retrieve(reseller.stripe_connect_account_id)
        if not (account.charges_enabled and account.payouts_enabled):
            logger.warning(f"Reseller {reseller.id} connected account not payout-ready")
            return None
    except stripe.error.StripeError:
        logger.warning(f"Could not verify reseller {reseller.id} connected account")
        return None
    
    return {
        "reseller_id": reseller.id,
        "stripe_connect_account_id": reseller.stripe_connect_account_id,
        "referral_code": reseller.referral_code,
    }
```

---

## Phase 4: Webhook Commission Ledger

### New Webhook Endpoint: POST /api/webhooks/connect

Handle Stripe Connect events for commission tracking.

```python
@router.post("/api/webhooks/connect")
async def stripe_connect_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_CONNECT_WEBHOOK_SECRET
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(400, "Invalid webhook signature")
    
    handlers = {
        "invoice.paid": _handle_invoice_paid,
        "charge.refunded": _handle_charge_refunded,
        "charge.dispute.created": _handle_dispute_created,
        "charge.dispute.closed": _handle_dispute_closed,
        "account.updated": _handle_account_updated,
    }
    
    handler = handlers.get(event["type"])
    if handler:
        await handler(event, db)
    
    return {"status": "ok"}


async def _handle_invoice_paid(event, db: Session):
    invoice = event["data"]["object"]
    subscription_id = invoice.get("subscription")
    
    if not subscription_id:
        return
    
    # Look up subscription to find reseller metadata
    subscription = stripe.Subscription.retrieve(subscription_id)
    reseller_id = subscription.metadata.get("reseller_id")
    
    if not reseller_id:
        return
    
    # Find the subscriber
    customer_id = invoice["customer"]
    subscriber = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not subscriber:
        return
    
    gross_amount = invoice["amount_paid"]  # in cents
    commission_amount = int(gross_amount * 0.20)  # 20% commission
    
    # Check for duplicate entries
    existing = db.query(CommissionLedger).filter(
        CommissionLedger.stripe_invoice_id == invoice["id"],
        CommissionLedger.event_type == "invoice_paid",
    ).first()
    if existing:
        return
    
    entry = CommissionLedger(
        reseller_id=int(reseller_id),
        subscriber_id=subscriber.id,
        stripe_invoice_id=invoice["id"],
        event_type="invoice_paid",
        gross_amount=gross_amount,
        commission_amount=commission_amount,
        currency=invoice.get("currency", "usd"),
        stripe_transfer_id=invoice.get("transfer_data", {}).get("destination"),
        metadata={"subscription_id": subscription_id},
    )
    db.add(entry)
    db.commit()


async def _handle_charge_refunded(event, db: Session):
    charge = event["data"]["object"]
    invoice_id = charge.get("invoice")
    
    if not invoice_id:
        return
    
    # Find original commission entry
    original = db.query(CommissionLedger).filter(
        CommissionLedger.stripe_invoice_id == invoice_id,
        CommissionLedger.event_type == "invoice_paid",
    ).first()
    
    if not original:
        return
    
    refund_amount = charge["amount_refunded"]  # in cents
    commission_reversal = int(refund_amount * 0.20)
    
    entry = CommissionLedger(
        reseller_id=original.reseller_id,
        subscriber_id=original.subscriber_id,
        stripe_invoice_id=invoice_id,
        event_type="refund",
        gross_amount=-refund_amount,
        commission_amount=-commission_reversal,
        currency=charge.get("currency", "usd"),
        metadata={"charge_id": charge["id"], "refund_amount": refund_amount},
    )
    db.add(entry)
    db.commit()


async def _handle_dispute_created(event, db: Session):
    dispute = event["data"]["object"]
    charge_id = dispute["charge"]
    
    # Get the charge to find the invoice
    charge = stripe.Charge.retrieve(charge_id)
    invoice_id = charge.get("invoice")
    
    if not invoice_id:
        return
    
    original = db.query(CommissionLedger).filter(
        CommissionLedger.stripe_invoice_id == invoice_id,
        CommissionLedger.event_type == "invoice_paid",
    ).first()
    
    if not original:
        return
    
    disputed_amount = dispute["amount"]
    commission_hold = int(disputed_amount * 0.20)
    
    entry = CommissionLedger(
        reseller_id=original.reseller_id,
        subscriber_id=original.subscriber_id,
        stripe_invoice_id=invoice_id,
        event_type="dispute_created",
        gross_amount=-disputed_amount,
        commission_amount=-commission_hold,
        currency=dispute.get("currency", "usd"),
        metadata={"dispute_id": dispute["id"], "status": dispute["status"]},
    )
    db.add(entry)
    db.commit()


async def _handle_dispute_closed(event, db: Session):
    dispute = event["data"]["object"]
    charge = stripe.Charge.retrieve(dispute["charge"])
    invoice_id = charge.get("invoice")
    
    if not invoice_id:
        return
    
    original = db.query(CommissionLedger).filter(
        CommissionLedger.stripe_invoice_id == invoice_id,
        CommissionLedger.event_type == "invoice_paid",
    ).first()
    
    if not original:
        return
    
    if dispute["status"] == "won":
        # Dispute won by platform - reverse the hold
        disputed_amount = dispute["amount"]
        commission_reversal = int(disputed_amount * 0.20)
        
        entry = CommissionLedger(
            reseller_id=original.reseller_id,
            subscriber_id=original.subscriber_id,
            stripe_invoice_id=invoice_id,
            event_type="dispute_resolved",
            gross_amount=disputed_amount,
            commission_amount=commission_reversal,
            currency=dispute.get("currency", "usd"),
            metadata={"dispute_id": dispute["id"], "outcome": "won"},
        )
        db.add(entry)
        db.commit()


async def _handle_account_updated(event, db: Session):
    account = event["data"]["object"]
    account_id = account["id"]
    
    user = db.query(User).filter(User.stripe_connect_account_id == account_id).first()
    if not user:
        return
    
    is_ready = account.get("charges_enabled") and account.get("payouts_enabled")
    
    if is_ready and user.reseller_status == 'onboarding':
        user.reseller_status = 'active'
        user.reseller_onboarded_at = datetime.utcnow()
        db.commit()
```

### Reseller Dashboard Data Endpoints

```python
@router.get("/api/resellers/dashboard")
async def reseller_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_reseller or current_user.reseller_status != 'active':
        raise HTTPException(403, "Not an active reseller")
    
    # Total lifetime earned
    total_earned = db.query(func.coalesce(func.sum(CommissionLedger.commission_amount), 0)).filter(
        CommissionLedger.reseller_id == current_user.id,
    ).scalar()
    
    # Active referred subscribers
    active_referrals = db.query(User).filter(
        User.referred_by_reseller_id == current_user.id,
        User.is_active == True,
    ).count()
    
    # Total referred users
    total_referrals = db.query(User).filter(
        User.referred_by_reseller_id == current_user.id,
    ).count()
    
    # Current month earnings
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    current_month = db.query(func.coalesce(func.sum(CommissionLedger.commission_amount), 0)).filter(
        CommissionLedger.reseller_id == current_user.id,
        CommissionLedger.created_at >= month_start,
    ).scalar()
    
    return {
        "total_earned_cents": total_earned,
        "current_month_cents": current_month,
        "active_referrals": active_referrals,
        "total_referrals": total_referrals,
        "reseller_status": current_user.reseller_status,
        "referral_code": current_user.referral_code,
        "stripe_connect_account_id": current_user.stripe_connect_account_id,
    }


@router.get("/api/resellers/referrals")
async def reseller_referrals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_reseller or current_user.reseller_status != 'active':
        raise HTTPException(403, "Not an active reseller")
    
    referrals = db.query(User).filter(
        User.referred_by_reseller_id == current_user.id,
    ).order_by(User.created_at.desc()).limit(100).all()
    
    # Anonymize emails
    def anonymize_email(email: str) -> str:
        parts = email.split("@")
        if len(parts) != 2:
            return "***"
        name = parts[0]
        domain = parts[1]
        return f"{name[0]}{'*' * (len(name) - 1)}@{domain}"
    
    return {
        "referrals": [
            {
                "email": anonymize_email(r.email),
                "signed_up": r.created_at.isoformat(),
                "is_active": r.is_active,
            }
            for r in referrals
        ]
    }


@router.get("/api/resellers/stripe-login")
async def reseller_stripe_login(current_user: User = Depends(get_current_user)):
    if not current_user.stripe_connect_account_id:
        raise HTTPException(400, "No connected Stripe account found")
    
    if current_user.reseller_status != 'active':
        raise HTTPException(403, "Reseller account not active")
    
    login_link = stripe.Account.create_login_link(current_user.stripe_connect_account_id)
    return {"login_url": login_link.url}
```

---

## Testing Checklist

1. **Unit tests**: Registration with reseller referral code, `_resolve_reseller_split` logic
2. **Integration tests (Stripe test mode)**:
   - Create Express account, complete onboarding with test data
   - Create subscription checkout with `transfer_data` and verify split
   - Trigger test invoice, verify commission ledger entry
   - Issue refund, verify negative ledger entry
   - Simulate dispute lifecycle
3. **Edge cases**:
   - Referral code from non-reseller user (should not split)
   - Reseller in 'suspended' status (should not split)
   - Connected account not payout-ready (should fall back)
   - Duplicate webhook delivery (idempotency check)

---

## Environment Variables Summary

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Existing - platform Stripe key |
| `STRIPE_WEBHOOK_SECRET` | Existing - for platform webhooks |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | New - for Connect webhook endpoint |
| `FRONTEND_URL` | Base URL for onboarding redirects (e.g., `https://heyjunior.ai`) |
