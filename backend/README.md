# Junior LinkedIn Automation - Payment Backend

## Overview
Backend infrastructure for processing payments and managing subscriptions for the Junior LinkedIn Automation Tool.

## Technical Stack
- Python 3.8+ (3.13 not yet supported)
- PostgreSQL 12+
- Stripe API
- FastAPI/Uvicorn

## Required Environment Variables
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/junior_db

# Application Configuration
SECRET_KEY=your-secret-key-here
DEBUG=False
HOST=0.0.0.0
PORT=8000
```

## Infrastructure Requirements

### 1. Database Setup
- PostgreSQL 12+ instance
- Database name: `junior_db`
- User with full privileges on `junior_db`
- SSL enabled for production

### 2. Server Requirements
- Linux server (Ubuntu 20.04+ recommended)
- Python 3.8+ installed
- Nginx as reverse proxy
- SSL certificates (Let's Encrypt recommended)
- Systemd service for process management

### 3. Stripe Configuration
1. Create Stripe Product:
   - Name: "LinkedIn Automation Tool - Beta"
   - Price: $20.00 USD/month
   - ID: `price_beta_20_monthly`

2. Configure Webhooks:
   - URL: `https://your-domain.com/webhook`
   - Events to monitor:
     - `invoice.payment_succeeded`
     - `customer.subscription.deleted`
     - `payment_intent.succeeded`

## Deployment Steps

1. **Server Setup**:
   ```bash
   # Install dependencies
   sudo apt update
   sudo apt install python3-pip python3-venv nginx postgresql

   # Create application directory
   mkdir -p /opt/junior
   cd /opt/junior

   # Clone repository
   git clone https://github.com/Andrew-AI-JR/heyjunior-website.git
   cd heyjunior-website/backend

   # Create virtual environment
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Database Setup**:
   ```sql
   CREATE DATABASE junior_db;
   CREATE USER junior_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE junior_db TO junior_user;
   ```

3. **Nginx Configuration**:
   ```nginx
   server {
       listen 443 ssl;
       server_name your-domain.com;

       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

       location / {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. **Systemd Service**:
   ```ini
   [Unit]
   Description=Junior Payment Backend
   After=network.target

   [Service]
   User=junior
   Group=junior
   WorkingDirectory=/opt/junior/heyjunior-website/backend
   Environment="PATH=/opt/junior/heyjunior-website/backend/venv/bin"
   EnvironmentFile=/opt/junior/heyjunior-website/backend/.env
   ExecStart=/opt/junior/heyjunior-website/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

   [Install]
   WantedBy=multi-user.target
   ```

5. **Environment Setup**:
   - Copy `.env.example` to `.env`
   - Update with production values
   - Ensure file permissions are secure:
     ```bash
     chmod 600 .env
     ```

## Testing the Deployment

1. **Health Check**:
   ```bash
   curl https://your-domain.com/health
   ```

2. **Test Payment**:
   ```bash
   # Using test card
   curl -X POST https://your-domain.com/create-payment-intent \
     -H "Content-Type: application/json" \
     -d '{"amount": 2000, "currency": "usd"}'
   ```

## Monitoring

1. **Logs**:
   - Application logs: `journalctl -u junior-payment`
   - Nginx access logs: `/var/log/nginx/access.log`
   - Nginx error logs: `/var/log/nginx/error.log`

2. **Stripe Dashboard**:
   - Monitor webhooks in Stripe Dashboard
   - Set up alerts for failed webhooks
   - Monitor payment success rates

## Security Considerations

1. **SSL/TLS**:
   - Keep certificates up to date
   - Configure strong SSL settings in Nginx
   - Enable HSTS

2. **Database**:
   - Regular backups
   - Strong passwords
   - Limited network access

3. **API Security**:
   - Rate limiting enabled
   - CORS properly configured
   - Input validation on all endpoints

## Contact
For any deployment issues or questions:
- Email: support@heyjunior.ai
- GitHub: Open an issue in the repository 