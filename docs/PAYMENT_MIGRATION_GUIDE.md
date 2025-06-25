# Payment System Migration Guide

## Overview
This document outlines the migration from the current Stripe Payment Links implementation to a more secure and maintainable Stripe Checkout with User Authentication system.

## Table of Contents
1. [Current Implementation](#current-implementation)
2. [New Architecture](#new-architecture)
3. [Migration Steps](#migration-steps)
4. [Frontend Changes](#frontend-changes)
5. [Backend Changes](#backend-changes)
6. [Testing Plan](#testing-plan)
7. [Rollback Plan](#rollback-plan)

## Current Implementation
- Uses Stripe Payment Links with client-side URL manipulation
- No user authentication before payment
- Coupon handling done client-side
- Limited error handling and validation

## New Architecture

### Components
1. **Authentication Service**
   - JWT-based auth
   - Email/password registration and login
   - Token management

2. **Checkout Flow**
   - User authenticates/registers
   - Creates secure checkout session
   - Handles payment via Stripe Checkout
   - Processes webhook events

## Migration Steps

### 1. Backend Setup
1. Install required packages:
   ```bash
   npm install jsonwebtoken bcryptjs stripe
   ```

2. Create environment variables (`.env`):
   ```env
   JWT_SECRET=your_jwt_secret
   STRIPE_SECRET_KEY=sk_test_your_stripe_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   FRONTEND_URL=http://localhost:3000
   ```

## Frontend Changes

### 1. Auth Service
Create `src/services/authService.js`:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const authService = {
  async register(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return this._handleAuthResponse(response);
  },

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return this._handleAuthResponse(response);
  },

  async _handleAuthResponse(response) {
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    return data;
  },

  getAccessToken() {
    return localStorage.getItem('access_token');
  },

  isAuthenticated() {
    return !!this.getAccessToken();
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
};
```

### 2. Updated Checkout Component
Update `checkout.js`:
```javascript
import { authService } from './services/authService';

document.addEventListener('DOMContentLoaded', () => {
  // Existing initialization code...
  
  // Add auth state check
  if (!authService.isAuthenticated()) {
    showAuthModal();
  }
});

async function handleProceedToPayment(e) {
  e.preventDefault();
  
  if (!authService.isAuthenticated()) {
    showAuthModal();
    return;
  }

  const platform = document.querySelector('input[name="platform"]:checked')?.value;
  
  try {
    const response = await fetch('/api/payments/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authService.getAccessToken()}`
      },
      body: JSON.stringify({
        price_id: getPriceId(platform),
        success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/pricing`
      })
    });

    const { url } = await response.json();
    window.location.href = url;
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Error starting checkout. Please try again.');
  }
}
```

## Backend Changes

### 1. Auth Routes
Create `routes/auth.js`:
```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Mock DB - Replace with actual DB calls
const users = [];

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    if (users.some(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = { id: users.length + 1, email, passwordHash };
    users.push(user);

    // Generate tokens
    const tokens = generateTokens(user);
    res.json(tokens);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Add login endpoint and other auth routes...

function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { access_token: accessToken, refresh_token: refreshToken };
}

module.exports = router;
```

### 2. Checkout Routes
Create `routes/checkout.js`:
```javascript
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { price_id, success_url, cancel_url } = req.body;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: price_id,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: {
        userId: req.user.id
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook handler for Stripe events
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // Update order status in your database
      break;
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      // Handle successful payment
      break;
    // Handle other event types...
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
```

## Testing Plan

1. **Unit Tests**
   - Test auth service functions
   - Test API endpoints
   - Test Stripe webhook handlers

2. **Integration Tests**
   - Test complete checkout flow
   - Test error scenarios
   - Test webhook handling

3. **Manual Testing**
   - Test registration and login
   - Test checkout process
   - Verify webhook events

## Rollback Plan

1. **Immediate Rollback**
   - Revert code changes
   - Restore previous Stripe configuration

2. **Data Migration**
   - Backup new user data
   - Plan for data migration if needed

3. **Communication**
   - Notify users of any downtime
   - Update status page

## Next Steps

1. **Immediate Next Steps**
   - Set up staging environment
   - Deploy and test changes
   - Monitor for issues

2. **Future Enhancements**
   - Add social login
   - Implement subscription management
   - Add more payment methods

## Support
For any issues, contact the development team at dev@example.com.
