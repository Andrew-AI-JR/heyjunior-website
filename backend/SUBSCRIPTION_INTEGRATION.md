# Backend API Integration Guide - Subscription Tiers & Warmup Period

## Overview
This document outlines the necessary changes to integrate subscription tiers and warmup periods into the backend API.

## Database Changes

### 1. Update Subscription Model
Add to `models/subscription.py`:
```python
class Subscription(Base):
    # ... existing fields ...
    
    # New fields
    tier = Column(String, nullable=False, default="beta")
    start_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    warmup_enabled = Column(Boolean, nullable=False, default=True)
    current_daily_limit = Column(Integer)
    current_monthly_limit = Column(Integer)
```

### 2. Add Usage Tracking Model
Create `models/usage.py`:
```python
class Usage(Base):
    __tablename__ = "usage"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, nullable=False)
    comments_made = Column(Integer, default=0)
    monthly_total = Column(Integer, default=0)
    
    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uix_user_daily_usage'),
    )
```

## API Endpoints

### 1. Add Tier Management Endpoints
Add to `routers/subscriptions.py`:
```python
@router.get("/subscription/limits")
async def get_subscription_limits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's subscription limits based on tier and warmup period"""
    subscription = get_active_subscription(current_user.id, db)
    if not subscription:
        raise HTTPException(status_code=402, detail="No active subscription")
        
    limits = calculate_current_limits(subscription)
    return limits

@router.get("/subscription/usage")
async def get_subscription_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's usage statistics"""
    today = datetime.utcnow().date()
    usage = get_user_usage(current_user.id, today, db)
    return usage
```

### 2. Update Webhook Handler
Modify `routers/webhooks.py`:
```python
@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    # ... existing webhook handling ...
    
    if event.type == "customer.subscription.created":
        # Initialize subscription with tier limits
        subscription = db.query(Subscription).filter_by(
            stripe_subscription_id=event.data.object.id
        ).first()
        if subscription:
            initialize_subscription_limits(subscription, db)
            
    elif event.type == "customer.subscription.updated":
        # Update tier limits if plan changed
        update_subscription_limits(event.data.object, db)
```

## Utility Functions

Create `utils/subscription_limits.py`:
```python
from datetime import datetime, timedelta

TIER_LIMITS = {
    "beta": {
        "daily_min": 40,
        "daily_max": 50,
        "monthly_min": 1200,
        "monthly_max": 1500,
        "warmup": {
            "week1_percentage": 25,
            "week2_percentage": 75,
            "week3_percentage": 100,
            "week4_percentage": 100
        }
    },
    "pro": {
        "daily_min": 70,
        "daily_max": 80,
        "monthly_min": 2100,
        "monthly_max": 2400,
        "warmup": {
            "week1_percentage": 25,
            "week2_percentage": 75,
            "week3_percentage": 100,
            "week4_percentage": 100
        }
    }
}

def calculate_current_limits(subscription: Subscription) -> dict:
    """Calculate current limits based on tier and warmup period"""
    tier_config = TIER_LIMITS[subscription.tier]
    
    if not subscription.warmup_enabled:
        return {
            "daily_limit": tier_config["daily_max"],
            "monthly_limit": tier_config["monthly_max"],
            "is_warmup": False
        }
    
    days_since_start = (datetime.utcnow() - subscription.start_date).days
    week_number = min(4, (days_since_start // 7) + 1)
    
    percentage = tier_config["warmup"][f"week{week_number}_percentage"]
    daily_limit = int(tier_config["daily_max"] * (percentage / 100))
    monthly_limit = int(tier_config["monthly_max"] * (percentage / 100))
    
    return {
        "daily_limit": daily_limit,
        "monthly_limit": monthly_limit,
        "is_warmup": week_number < 4,
        "warmup_week": week_number,
        "warmup_percentage": percentage
    }

def get_user_usage(user_id: int, date: date, db: Session) -> dict:
    """Get user's current usage statistics"""
    # Get daily usage
    daily_usage = db.query(Usage).filter(
        Usage.user_id == user_id,
        Usage.date == date
    ).first()
    
    # Get monthly usage
    start_of_month = date.replace(day=1)
    monthly_usage = db.query(func.sum(Usage.comments_made)).filter(
        Usage.user_id == user_id,
        Usage.date >= start_of_month,
        Usage.date <= date
    ).scalar() or 0
    
    return {
        "daily_usage": daily_usage.comments_made if daily_usage else 0,
        "monthly_usage": monthly_usage
    }

def can_make_comment(user_id: int, db: Session) -> tuple[bool, str]:
    """Check if user can make a comment based on their limits"""
    subscription = get_active_subscription(user_id, db)
    if not subscription:
        return False, "No active subscription"
        
    limits = calculate_current_limits(subscription)
    usage = get_user_usage(user_id, datetime.utcnow().date(), db)
    
    if usage["daily_usage"] >= limits["daily_limit"]:
        return False, "Daily limit reached"
        
    if usage["monthly_usage"] >= limits["monthly_limit"]:
        return False, "Monthly limit reached"
        
    return True, "OK"
```

## Integration Steps

1. **Database Migration**:
   ```bash
   # Create migration
   alembic revision --autogenerate -m "add subscription tiers and usage tracking"
   
   # Apply migration
   alembic upgrade head
   ```

2. **Update Comment Generation**:
   Modify the comment generation endpoint to check limits:
   ```python
   @router.post("/generate-comment")
   async def generate_comment(
       request: CommentRequest,
       current_user: User = Depends(get_current_user),
       db: Session = Depends(get_db)
   ):
       # Check limits before generating
       can_comment, message = can_make_comment(current_user.id, db)
       if not can_comment:
           raise HTTPException(status_code=429, detail=message)
           
       # ... existing comment generation code ...
       
       # Update usage after successful generation
       update_usage(current_user.id, db)
   ```

3. **Environment Variables**:
   Add to `.env`:
   ```env
   WARMUP_ENABLED=true
   DEFAULT_TIER=beta
   ```

## Testing

Add new tests in `tests/test_subscription_limits.py`:
```python
def test_warmup_period_calculation():
    """Test warmup period limit calculations"""
    
def test_usage_tracking():
    """Test usage tracking functionality"""
    
def test_limit_enforcement():
    """Test enforcement of daily and monthly limits"""
```

## Frontend Integration

The frontend can fetch current limits and usage via:
```javascript
// Get current limits
const limits = await api.get('/subscription/limits');

// Get current usage
const usage = await api.get('/subscription/usage');

// Display progress
const dailyProgress = (usage.daily_usage / limits.daily_limit) * 100;
const monthlyProgress = (usage.monthly_usage / limits.monthly_limit) * 100;
``` 