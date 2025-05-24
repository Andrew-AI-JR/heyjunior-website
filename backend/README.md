# Junior LinkedIn Automation Backend

Local PostgreSQL backend for processing payments and managing subscriptions for the Junior LinkedIn Automation Tool.

## Features

- 💳 Stripe payment processing
- 📊 PostgreSQL database
- 🔐 License key generation
- 📦 Secure download tokens
- 🔄 Subscription management
- 📧 Webhook handling

## Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Stripe account

## Quick Setup

1. **Run the setup script:**
   ```bash
   cd heyjunior-website/backend
   python setup.py
   ```

2. **Update Stripe configuration:**
   - Edit the `.env` file with your Stripe keys
   - Set up Stripe products and webhooks (instructions provided by setup script)

3. **Start the server:**
   ```bash
   python main.py
   ```

4. **Access the API:**
   - Server: http://localhost:8000
   - Documentation: http://localhost:8000/docs

## Manual Setup

If you prefer manual setup:

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Database Setup

```sql
-- Connect to PostgreSQL as admin
createdb junior_db
createuser junior_user --pwprompt
psql -c "GRANT ALL PRIVILEGES ON DATABASE junior_db TO junior_user;"
```

### 3. Environment Configuration

Copy `config.env.example` to `.env` and update:

```bash
DATABASE_URL=postgresql://junior_user:password@localhost:5432/junior_db
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### 4. Stripe Setup

1. Create a product in Stripe:
   - Name: "LinkedIn Automation Tool - Beta"
   - Price: $20.00 USD/month
   - Price ID: `price_beta_20_monthly`

2. Set up webhook:
   - URL: `http://localhost:8000/webhook`
   - Events: `invoice.payment_succeeded`, `customer.subscription.deleted`

## API Endpoints

### Payment Processing
- `POST /create-payment-intent` - Create payment intent
- `POST /create-subscription` - Create subscription
- `POST /webhook` - Stripe webhook handler

### Downloads
- `GET /download/{token}` - Secure download with token

### Health
- `GET /health` - Health check

## Database Schema

### Tables
- **users** - Customer information
- **subscriptions** - Stripe subscriptions
- **payments** - Payment records
- **download_tokens** - Secure download links
- **license_keys** - Software license keys

## Testing

Test the payment flow:

1. Start the backend: `python main.py`
2. Open your website: `purchase.html`
3. Use Stripe test cards:
   - Success: `4242424242424242`
   - Decline: `4000000000000002`

## Production Deployment

For production:

1. Use production Stripe keys
2. Set up SSL/TLS
3. Use a production-grade WSGI server
4. Configure proper database security
5. Set up monitoring and logging

## Troubleshooting

### Common Issues

**Database connection failed:**
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Check connection
psql -h localhost -U junior_user -d junior_db
```

**Stripe webhook not working:**
- Check webhook URL is accessible
- Verify webhook secret in .env
- Check webhook events are configured

**CORS errors:**
- Ensure frontend URL is in CORS origins
- Check API_BASE_URL in frontend matches backend

## File Structure

```
backend/
├── main.py              # FastAPI application
├── database.py          # Database connection
├── models.py            # SQLAlchemy models
├── requirements.txt     # Python dependencies
├── setup.py            # Setup script
├── config.env.example  # Environment template
└── README.md           # This file
```

## Support

For issues:
1. Check the logs in the terminal
2. Verify Stripe configuration
3. Test database connectivity
4. Check webhook delivery in Stripe dashboard 