# Reseller Backend Implementation Guide

This document provides backend (`api.heyjunior.ai`) implementation details for the two-level commission system using Stripe Connect Express.

Commission model:

- Reseller receives 20% of net collected subscription revenue.
- Salesperson receives 20% of net collected subscription revenue for subscribers sourced by resellers they onboarded.
- Net collected revenue excludes Stripe processing fees, sales tax/VAT, refunds, credits, chargebacks, and lost disputes.
- Junior remains Merchant of Record and owns refund/dispute decisions.
- All payouts are manual `stripe.Transfer.create()` calls from webhook processing. Do not use subscription `transfer_data.destination` or `application_fee_percent`.

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
ALTER TABLE users ADD COLUMN is_salesperson BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN salesperson_status VARCHAR(20) DEFAULT NULL
  CHECK (salesperson_status IN ('pending', 'onboarding', 'active', 'suspended'));
ALTER TABLE users ADD COLUMN salesperson_stripe_connect_account_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN salesperson_onboarded_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN reseller_onboarded_by_salesperson_id INTEGER REFERENCES users(id) DEFAULT NULL;

CREATE INDEX idx_users_reseller_status ON users(reseller_status) WHERE is_reseller = TRUE;
CREATE INDEX idx_users_referred_by ON users(referred_by_reseller_id) WHERE referred_by_reseller_id IS NOT NULL;
CREATE INDEX idx_users_salesperson_status ON users(salesperson_status) WHERE is_salesperson = TRUE;
CREATE INDEX idx_users_reseller_salesperson ON users(reseller_onboarded_by_salesperson_id) WHERE reseller_onboarded_by_salesperson_id IS NOT NULL;
```

```sql
-- Migration: create_commission_ledger
CREATE TABLE commission_ledger (
    id SERIAL PRIMARY KEY,
    recipient_user_id INTEGER NOT NULL REFERENCES users(id),
    recipient_role VARCHAR(20) NOT NULL
      CHECK (recipient_role IN ('reseller', 'salesperson')),
    subscriber_id INTEGER NOT NULL REFERENCES users(id),
    stripe_invoice_id VARCHAR(255) NOT NULL,
    stripe_event_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL
      CHECK (event_type IN ('invoice_paid', 'refund', 'dispute_created', 'dispute_resolved')),
    gross_invoice_amount INTEGER NOT NULL,
    stripe_fee_amount INTEGER NOT NULL,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    net_commission_base INTEGER NOT NULL,
    commission_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    commission_amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    stripe_transfer_id VARCHAR(255),
    transfer_status VARCHAR(20) NOT NULL DEFAULT 'pending'
      CHECK (transfer_status IN ('pending', 'completed', 'failed', 'reversed', 'abandoned')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_commission_ledger_recipient ON commission_ledger(recipient_user_id, recipient_role);
CREATE INDEX idx_commission_ledger_invoice ON commission_ledger(stripe_invoice_id);
CREATE INDEX idx_commission_ledger_created ON commission_ledger(created_at);
CREATE UNIQUE INDEX idx_commission_ledger_invoice_paid_recipient
  ON commission_ledger(stripe_invoice_id, recipient_user_id, recipient_role)
  WHERE event_type = 'invoice_paid';
CREATE UNIQUE INDEX idx_commission_ledger_event_recipient
  ON commission_ledger(stripe_event_id, recipient_user_id, recipient_role)
  WHERE stripe_event_id IS NOT NULL;
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
    is_salesperson: bool = False
    salesperson_status: Optional[str] = None
```

And to `GET /api/users/me/referral`:

```python
class ReferralResponse(BaseModel):
    referral_code: Optional[str]
    referrals_count: int
    is_reseller: bool = False
    reseller_status: Optional[str] = None
    is_salesperson: bool = False
    salesperson_status: Optional[str] = None
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

### POST /api/salespeople/onboard

Creates a Stripe Express connected account for a salesperson. This should be admin-only unless salespeople self-serve inside an authenticated internal portal.

```python
@router.post("/api/salespeople/onboard")
async def salesperson_onboard(
    salesperson_user_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    salesperson = db.query(User).filter(
        User.id == salesperson_user_id,
        User.is_salesperson == True,
        User.salesperson_status.in_(("pending", "onboarding")),
    ).first()
    if not salesperson:
        raise HTTPException(404, "Salesperson not found or not eligible for onboarding")

    if not salesperson.salesperson_stripe_connect_account_id:
        account = stripe.Account.create(
            type="express",
            email=salesperson.email,
            capabilities={"transfers": {"requested": True}},
            metadata={
                "junior_user_id": str(salesperson.id),
                "junior_role": "salesperson",
            },
        )
        salesperson.salesperson_stripe_connect_account_id = account.id
        salesperson.salesperson_status = "onboarding"
        db.commit()

    account_link = stripe.AccountLink.create(
        account=salesperson.salesperson_stripe_connect_account_id,
        refresh_url=f"{FRONTEND_URL}/salesperson-dashboard.html?onboarding=refresh",
        return_url=f"{FRONTEND_URL}/salesperson-dashboard.html?onboarding=complete",
        type="account_onboarding",
    )

    return {"onboarding_url": account_link.url}
```

---

## Phase 3: Checkout Session Attribution Logic

### Modify POST /api/payments/create-checkout-session

```python
@router.post("/api/payments/create-checkout-session")
async def create_checkout_session(request: CheckoutRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reseller_attribution = _resolve_reseller_attribution(current_user, db)

    checkout_params = {
        "mode": "subscription",
        "line_items": [{"price": request.price_id, "quantity": 1}],
        "success_url": request.success_url,
        "cancel_url": request.cancel_url,
        "customer": current_user.stripe_customer_id,
        # ... existing params (metadata, coupon, etc.) ...
    }
    
    # Store reseller/salesperson attribution only. Do not use transfer_data or
    # application_fee_percent because commission payouts are created by webhook.
    if reseller_attribution:
        checkout_params["subscription_data"] = {
            "metadata": {
                "reseller_id": str(reseller_attribution["reseller_id"]),
                "salesperson_id": str(reseller_attribution["salesperson_id"] or ""),
                "reseller_code": reseller_attribution["referral_code"],
            },
        }
    
    try:
        session = stripe.checkout.Session.create(**checkout_params)
        return {"checkout_url": session.url}
    except stripe.error.StripeError as e:
        logger.exception("Stripe checkout session creation failed")
        raise HTTPException(500, "Failed to create checkout session.")


def _resolve_reseller_attribution(user: User, db: Session) -> Optional[dict]:
    """Resolve subscriber attribution without checking payout readiness.

    Payout readiness is checked when the invoice is paid. This prevents checkout
    from failing because a reseller or salesperson has a temporary Connect issue.
    """
    if not user.referred_by_reseller_id:
        return None
    
    reseller = db.query(User).filter(
        User.id == user.referred_by_reseller_id,
        User.is_reseller == True,
        User.reseller_status == 'active',
    ).first()
    
    if not reseller:
        return None
    
    return {
        "reseller_id": reseller.id,
        "salesperson_id": reseller.reseller_onboarded_by_salesperson_id,
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
    
    # Look up subscription to find reseller/salesperson metadata
    subscription = stripe.Subscription.retrieve(subscription_id)
    reseller_id = subscription.metadata.get("reseller_id")
    salesperson_id = subscription.metadata.get("salesperson_id")
    
    if not reseller_id:
        return
    
    # Find the subscriber
    customer_id = invoice["customer"]
    subscriber = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not subscriber:
        return
    
    gross_invoice_amount = invoice["amount_paid"]  # in cents
    tax_amount = sum(item.get("amount", 0) for item in invoice.get("total_tax_amounts", []))
    stripe_fee_amount = _get_stripe_fee_amount(invoice)
    net_commission_base = max(gross_invoice_amount - stripe_fee_amount - tax_amount, 0)
    
    _create_commission_transfer(
        recipient_id=int(reseller_id),
        recipient_role="reseller",
        subscriber=subscriber,
        invoice=invoice,
        subscription_id=subscription_id,
        gross_invoice_amount=gross_invoice_amount,
        stripe_fee_amount=stripe_fee_amount,
        tax_amount=tax_amount,
        net_commission_base=net_commission_base,
        db=db,
    )

    if salesperson_id:
        _create_commission_transfer(
            recipient_id=int(salesperson_id),
            recipient_role="salesperson",
            subscriber=subscriber,
            invoice=invoice,
            subscription_id=subscription_id,
            gross_invoice_amount=gross_invoice_amount,
            stripe_fee_amount=stripe_fee_amount,
            tax_amount=tax_amount,
            net_commission_base=net_commission_base,
            db=db,
        )


def _get_stripe_fee_amount(invoice) -> int:
    """Return exact Stripe processing fee from the charge balance transaction."""
    charge_id = invoice.get("charge")
    if not charge_id:
        return 0

    charge = stripe.Charge.retrieve(charge_id, expand=["balance_transaction"])
    balance_txn = charge.get("balance_transaction")
    if isinstance(balance_txn, dict):
        return balance_txn.get("fee", 0) or 0
    return 0


def _create_commission_transfer(
    recipient_id: int,
    recipient_role: str,
    subscriber: User,
    invoice: dict,
    subscription_id: str,
    gross_invoice_amount: int,
    stripe_fee_amount: int,
    tax_amount: int,
    net_commission_base: int,
    db: Session,
):
    existing = db.query(CommissionLedger).filter(
        CommissionLedger.stripe_invoice_id == invoice["id"],
        CommissionLedger.event_type == "invoice_paid",
        CommissionLedger.recipient_user_id == recipient_id,
        CommissionLedger.recipient_role == recipient_role,
    ).first()
    if existing:
        return

    recipient = db.query(User).filter(User.id == recipient_id).first()
    connect_account_id = (
        recipient.stripe_connect_account_id
        if recipient_role == "reseller"
        else recipient.salesperson_stripe_connect_account_id
    )
    commission_amount = int(net_commission_base * 0.20)

    entry = CommissionLedger(
        recipient_user_id=recipient_id,
        recipient_role=recipient_role,
        subscriber_id=subscriber.id,
        stripe_invoice_id=invoice["id"],
        event_type="invoice_paid",
        gross_invoice_amount=gross_invoice_amount,
        stripe_fee_amount=stripe_fee_amount,
        tax_amount=tax_amount,
        net_commission_base=net_commission_base,
        commission_percent=20.00,
        commission_amount=commission_amount,
        currency=invoice.get("currency", "usd"),
        transfer_status="pending",
        metadata={"subscription_id": subscription_id},
    )

    try:
        account = stripe.Account.retrieve(connect_account_id)
        if not (account.get("charges_enabled") and account.get("payouts_enabled")):
            raise RuntimeError("Connect account not payout-ready")

        transfer = stripe.Transfer.create(
            amount=commission_amount,
            currency=invoice.get("currency", "usd"),
            destination=connect_account_id,
            transfer_group=f"invoice_{invoice['id']}",
            metadata={
                "invoice_id": invoice["id"],
                "recipient_user_id": str(recipient_id),
                "recipient_role": recipient_role,
                "net_commission_base": str(net_commission_base),
            },
            idempotency_key=f"comm_{invoice['id']}_{recipient_role}_{recipient_id}",
        )
        entry.stripe_transfer_id = transfer.id
        entry.transfer_status = "completed"
    except Exception as exc:
        logger.exception("Commission transfer failed")
        entry.transfer_status = "failed"
        entry.metadata = {**entry.metadata, "transfer_error": str(exc)}

    db.add(entry)
    db.commit()


async def _handle_charge_refunded(event, db: Session):
    charge = event["data"]["object"]
    invoice_id = charge.get("invoice")
    
    if not invoice_id:
        return
    
    # Find original completed commission entries
    originals = db.query(CommissionLedger).filter(
        CommissionLedger.stripe_invoice_id == invoice_id,
        CommissionLedger.event_type == "invoice_paid",
        CommissionLedger.transfer_status == "completed",
    ).all()
    
    if not originals:
        return
    
    refund_amount = charge["amount_refunded"]  # in cents
    for original in originals:
        eligible_ratio = min(refund_amount / max(original.gross_invoice_amount - original.tax_amount, 1), 1)
        commission_reversal = int(original.commission_amount * eligible_ratio)
        if original.stripe_transfer_id:
            reversal = stripe.Transfer.create_reversal(
                original.stripe_transfer_id,
                amount=commission_reversal,
            )
            original.transfer_status = "reversed"
        else:
            reversal = None

        entry = CommissionLedger(
            recipient_user_id=original.recipient_user_id,
            recipient_role=original.recipient_role,
            subscriber_id=original.subscriber_id,
            stripe_invoice_id=invoice_id,
            event_type="refund",
            gross_invoice_amount=-refund_amount,
            stripe_fee_amount=0,
            tax_amount=0,
            net_commission_base=-int(original.net_commission_base * eligible_ratio),
            commission_percent=original.commission_percent,
            commission_amount=-commission_reversal,
            currency=charge.get("currency", "usd"),
            stripe_transfer_id=original.stripe_transfer_id,
            transfer_status="reversed",
            metadata={
                "charge_id": charge["id"],
                "refund_amount": refund_amount,
                "transfer_reversal_id": reversal.id if reversal else None,
            },
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
    
    originals = db.query(CommissionLedger).filter(
        CommissionLedger.stripe_invoice_id == invoice_id,
        CommissionLedger.event_type == "invoice_paid",
        CommissionLedger.transfer_status == "completed",
    ).all()
    
    if not originals:
        return
    
    for original in originals:
        disputed_ratio = min(dispute["amount"] / max(original.gross_invoice_amount - original.tax_amount, 1), 1)
        commission_hold = int(original.commission_amount * disputed_ratio)
        entry = CommissionLedger(
            recipient_user_id=original.recipient_user_id,
            recipient_role=original.recipient_role,
            subscriber_id=original.subscriber_id,
            stripe_invoice_id=invoice_id,
            event_type="dispute_created",
            gross_invoice_amount=-dispute["amount"],
            stripe_fee_amount=0,
            tax_amount=0,
            net_commission_base=-int(original.net_commission_base * disputed_ratio),
            commission_percent=original.commission_percent,
            commission_amount=-commission_hold,
            currency=dispute.get("currency", "usd"),
            stripe_transfer_id=original.stripe_transfer_id,
            transfer_status="pending",
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
    
    originals = db.query(CommissionLedger).filter(
        CommissionLedger.stripe_invoice_id == invoice_id,
        CommissionLedger.event_type == "invoice_paid",
    ).all()
    
    if not originals:
        return
    
    if dispute["status"] == "won":
        # Dispute won by platform - reverse any temporary dispute holds.
        for original in originals:
            disputed_ratio = min(dispute["amount"] / max(original.gross_invoice_amount - original.tax_amount, 1), 1)
            commission_reversal = int(original.commission_amount * disputed_ratio)
            entry = CommissionLedger(
                recipient_user_id=original.recipient_user_id,
                recipient_role=original.recipient_role,
                subscriber_id=original.subscriber_id,
                stripe_invoice_id=invoice_id,
                event_type="dispute_resolved",
                gross_invoice_amount=dispute["amount"],
                stripe_fee_amount=0,
                tax_amount=0,
                net_commission_base=int(original.net_commission_base * disputed_ratio),
                commission_percent=original.commission_percent,
                commission_amount=commission_reversal,
                currency=dispute.get("currency", "usd"),
                stripe_transfer_id=original.stripe_transfer_id,
                transfer_status="completed",
                metadata={"dispute_id": dispute["id"], "outcome": "won"},
            )
            db.add(entry)
        db.commit()


async def _handle_account_updated(event, db: Session):
    account = event["data"]["object"]
    account_id = account["id"]
    
    user = db.query(User).filter(
        (User.stripe_connect_account_id == account_id) |
        (User.salesperson_stripe_connect_account_id == account_id)
    ).first()
    if not user:
        return
    
    is_ready = account.get("charges_enabled") and account.get("payouts_enabled")
    
    if is_ready and user.reseller_status == 'onboarding':
        user.reseller_status = 'active'
        user.reseller_onboarded_at = datetime.utcnow()
        db.commit()
    if is_ready and user.salesperson_status == 'onboarding':
        user.salesperson_status = 'active'
        user.salesperson_onboarded_at = datetime.utcnow()
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
        CommissionLedger.recipient_user_id == current_user.id,
        CommissionLedger.recipient_role == "reseller",
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
        CommissionLedger.recipient_user_id == current_user.id,
        CommissionLedger.recipient_role == "reseller",
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

### Salesperson Dashboard Data Endpoints

```python
@router.get("/api/salespeople/dashboard")
async def salesperson_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_salesperson or current_user.salesperson_status != 'active':
        raise HTTPException(403, "Not an active salesperson")

    total_earned = db.query(func.coalesce(func.sum(CommissionLedger.commission_amount), 0)).filter(
        CommissionLedger.recipient_user_id == current_user.id,
        CommissionLedger.recipient_role == "salesperson",
    ).scalar()

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    current_month = db.query(func.coalesce(func.sum(CommissionLedger.commission_amount), 0)).filter(
        CommissionLedger.recipient_user_id == current_user.id,
        CommissionLedger.recipient_role == "salesperson",
        CommissionLedger.created_at >= month_start,
    ).scalar()

    resellers_onboarded = db.query(User).filter(
        User.reseller_onboarded_by_salesperson_id == current_user.id,
    ).count()

    return {
        "total_earned_cents": total_earned,
        "current_month_cents": current_month,
        "resellers_onboarded": resellers_onboarded,
        "salesperson_status": current_user.salesperson_status,
        "stripe_connect_account_id": current_user.salesperson_stripe_connect_account_id,
    }


@router.get("/api/salespeople/resellers")
async def salesperson_resellers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_salesperson or current_user.salesperson_status != 'active':
        raise HTTPException(403, "Not an active salesperson")

    resellers = db.query(User).filter(
        User.reseller_onboarded_by_salesperson_id == current_user.id,
    ).order_by(User.created_at.desc()).limit(100).all()

    return {
        "resellers": [
            {
                "id": r.id,
                "email": r.email,
                "status": r.reseller_status,
                "referral_code": r.referral_code,
                "onboarded_at": r.reseller_onboarded_at.isoformat() if r.reseller_onboarded_at else None,
            }
            for r in resellers
        ]
    }


@router.get("/api/salespeople/stripe-login")
async def salesperson_stripe_login(current_user: User = Depends(get_current_user)):
    if not current_user.salesperson_stripe_connect_account_id:
        raise HTTPException(400, "No connected Stripe account found")

    if current_user.salesperson_status != 'active':
        raise HTTPException(403, "Salesperson account not active")

    login_link = stripe.Account.create_login_link(current_user.salesperson_stripe_connect_account_id)
    return {"login_url": login_link.url}
```

---

## Testing Checklist

1. **Unit tests**: Registration with reseller referral code, `_resolve_reseller_attribution` logic, net commission base calculation
2. **Integration tests (Stripe test mode)**:
   - Create Express account, complete onboarding with test data
   - Create subscription checkout and verify reseller/salesperson metadata is stamped
   - Trigger test invoice, fetch balance transaction fee, verify reseller and salesperson ledger entries
   - Verify Stripe transfers to both connected accounts
   - Issue refund, verify transfer reversals and negative ledger entries
   - Simulate dispute lifecycle
3. **Edge cases**:
   - Referral code from non-reseller user (should not stamp reseller metadata)
   - Reseller in 'suspended' status (should not stamp reseller metadata)
   - Salesperson missing (should only create reseller transfer)
   - Connected account not payout-ready (should write failed ledger row and retry later)
   - Duplicate webhook delivery (idempotency check)

---

## Environment Variables Summary

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Existing - platform Stripe key |
| `STRIPE_WEBHOOK_SECRET` | Existing - for platform webhooks |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | New - for Connect webhook endpoint |
| `FRONTEND_URL` | Base URL for onboarding redirects (e.g., `https://heyjunior.ai`) |
