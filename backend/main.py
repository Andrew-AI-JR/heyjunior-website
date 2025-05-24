from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import stripe
import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

from database import get_db, create_tables
from models import User, Subscription, Payment, DownloadToken, LicenseKey

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configure Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Junior LinkedIn Automation API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
create_tables()

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

# Pydantic models
class PaymentIntentRequest(BaseModel):
    items: list
    customer_email: Optional[str] = None
    subscription: bool = False

class SubscriptionRequest(BaseModel):
    customer_email: EmailStr
    price_id: str = "price_beta_20_monthly"  # Default to beta pricing

class WebhookRequest(BaseModel):
    type: str
    data: dict

# Create payment intent for one-time payments
@app.post("/create-payment-intent")
async def create_payment_intent(
    request: PaymentIntentRequest,
    db: Session = Depends(get_db)
):
    try:
        # Get or create user
        user = None
        if request.customer_email:
            user = db.query(User).filter(User.email == request.customer_email).first()
            if not user:
                # Create Stripe customer
                stripe_customer = stripe.Customer.create(
                    email=request.customer_email,
                    metadata={"source": "junior_beta"}
                )
                
                # Create user in database
                user = User(
                    email=request.customer_email,
                    stripe_customer_id=stripe_customer.id
                )
                db.add(user)
                db.commit()
                db.refresh(user)

        # Calculate amount (for beta: $20)
        amount = 2000  # $20.00 in cents
        
        if request.subscription:
            # For subscriptions, we'll create a setup intent instead
            setup_intent = stripe.SetupIntent.create(
                customer=user.stripe_customer_id if user else None,
                payment_method_types=['card'],
                metadata={
                    'type': 'subscription_setup',
                    'plan': 'beta',
                    'customer_email': request.customer_email or ''
                }
            )
            
            return {
                "clientSecret": setup_intent.client_secret,
                "customerId": user.stripe_customer_id if user else None
            }
        else:
            # Create payment intent for one-time payment
            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency='usd',
                customer=user.stripe_customer_id if user else None,
                metadata={
                    'type': 'one_time_payment',
                    'plan': 'beta',
                    'customer_email': request.customer_email or ''
                }
            )
            
            return {"clientSecret": intent.client_secret}
            
    except Exception as e:
        logger.error(f"Error creating payment intent: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Create subscription
@app.post("/create-subscription")
async def create_subscription(
    request: SubscriptionRequest,
    db: Session = Depends(get_db)
):
    try:
        # Get or create user
        user = db.query(User).filter(User.email == request.customer_email).first()
        if not user:
            # Create Stripe customer
            stripe_customer = stripe.Customer.create(
                email=request.customer_email,
                metadata={"source": "junior_beta"}
            )
            
            # Create user in database
            user = User(
                email=request.customer_email,
                stripe_customer_id=stripe_customer.id
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Create subscription in Stripe
        subscription = stripe.Subscription.create(
            customer=user.stripe_customer_id,
            items=[{
                'price': request.price_id,
            }],
            payment_behavior='default_incomplete',
            payment_settings={'save_default_payment_method': 'on_subscription'},
            expand=['latest_invoice.payment_intent'],
            metadata={
                'plan': 'beta',
                'user_id': str(user.id)
            }
        )

        return {
            "subscriptionId": subscription.id,
            "clientSecret": subscription.latest_invoice.payment_intent.client_secret
        }
        
    except Exception as e:
        logger.error(f"Error creating subscription: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Generate download token
def generate_download_token():
    return secrets.token_urlsafe(32)

# Generate license key
def generate_license_key(email: str, plan: str):
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))
    combined = f"{email}:{plan}:{timestamp}:{secrets.token_hex(16)}"
    return hashlib.sha256(combined.encode()).hexdigest()[:32].upper()

# Stripe webhook handler
@app.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        logger.error("Invalid payload")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logger.error("Invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        subscription_id = invoice['subscription']
        customer_id = invoice['customer']
        
        # Get customer details
        customer = stripe.Customer.retrieve(customer_id)
        
        # Get or create user
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if not user:
            user = User(
                email=customer.email,
                stripe_customer_id=customer_id
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Get subscription details
        stripe_subscription = stripe.Subscription.retrieve(subscription_id)
        
        # Create or update subscription in database
        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_id
        ).first()
        
        if not subscription:
            subscription = Subscription(
                user_id=user.id,
                stripe_subscription_id=subscription_id,
                stripe_price_id=stripe_subscription.items.data[0].price.id,
                status=stripe_subscription.status,
                current_period_start=datetime.fromtimestamp(
                    stripe_subscription.current_period_start, tz=timezone.utc
                ),
                current_period_end=datetime.fromtimestamp(
                    stripe_subscription.current_period_end, tz=timezone.utc
                )
            )
            db.add(subscription)
        else:
            subscription.status = stripe_subscription.status
            subscription.current_period_start = datetime.fromtimestamp(
                stripe_subscription.current_period_start, tz=timezone.utc
            )
            subscription.current_period_end = datetime.fromtimestamp(
                stripe_subscription.current_period_end, tz=timezone.utc
            )
        
        # Create payment record
        payment = Payment(
            user_id=user.id,
            stripe_payment_intent_id=invoice['payment_intent'],
            amount=invoice['amount_paid'] / 100,  # Convert from cents
            currency=invoice['currency'],
            status='succeeded',
            description=f"Beta subscription payment - {datetime.now(timezone.utc).strftime('%Y-%m')}"
        )
        db.add(payment)
        
        # Generate download token
        download_token = DownloadToken(
            user_id=user.id,
            token=generate_download_token(),
            downloads_remaining=3,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1)
        )
        db.add(download_token)
        
        # Generate license key
        license_key = generate_license_key(user.email, "beta")
        license = LicenseKey(
            user_id=user.id,
            license_key=license_key,
            plan_type="beta",
            status="active"
        )
        db.add(license)
        
        db.commit()
        
        logger.info(f"Payment succeeded for user {user.email}")
        
    elif event['type'] == 'customer.subscription.deleted':
        subscription_data = event['data']['object']
        subscription_id = subscription_data['id']
        
        # Update subscription status
        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == subscription_id
        ).first()
        
        if subscription:
            subscription.status = 'canceled'
            
            # Deactivate license key
            license = db.query(LicenseKey).filter(
                LicenseKey.user_id == subscription.user_id,
                LicenseKey.status == 'active'
            ).first()
            
            if license:
                license.status = 'suspended'
            
            db.commit()
            logger.info(f"Subscription canceled for user {subscription.user.email}")

    return {"status": "success"}

# Get download link (protected endpoint)
@app.get("/download/{token}")
async def get_download(token: str, db: Session = Depends(get_db)):
    download_token = db.query(DownloadToken).filter(
        DownloadToken.token == token,
        DownloadToken.downloads_remaining > 0,
        DownloadToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not download_token:
        raise HTTPException(status_code=404, detail="Invalid or expired download token")
    
    # Decrement downloads remaining
    download_token.downloads_remaining -= 1
    db.commit()
    
    # Return download information
    return {
        "download_url": "/static/LinkedIn_Automation_Tool_v2.1.1.exe",
        "filename": "LinkedIn_Automation_Tool_v2.1.1.exe",
        "downloads_remaining": download_token.downloads_remaining,
        "license_key": download_token.user.license_keys[0].license_key if download_token.user.license_keys else None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=os.getenv("HOST", "localhost"), 
        port=int(os.getenv("PORT", 8000)), 
        reload=True
    ) 