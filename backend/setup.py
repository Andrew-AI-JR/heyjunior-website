#!/usr/bin/env python3
"""
Setup script for Junior LinkedIn Automation Backend
This script helps initialize the database and environment
"""

import os
import sys
import subprocess
from pathlib import Path
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

def create_database():
    """Create the PostgreSQL database if it doesn't exist."""
    print("🗄️  Setting up PostgreSQL database...")
    
    # Default connection parameters
    default_params = {
        'host': 'localhost',
        'port': '5432',
        'user': 'postgres',
        'password': input("Enter PostgreSQL admin password: ")
    }
    
    db_name = input("Enter database name (default: junior_db): ") or "junior_db"
    db_user = input("Enter database username (default: junior_user): ") or "junior_user"
    db_password = input("Enter database password: ")
    
    try:
        # Connect to PostgreSQL as admin
        conn = psycopg2.connect(
            host=default_params['host'],
            port=default_params['port'],
            user=default_params['user'],
            password=default_params['password'],
            dbname='postgres'
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Create database
        print(f"Creating database: {db_name}")
        cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
        
        # Create user
        print(f"Creating user: {db_user}")
        cursor.execute(sql.SQL("CREATE USER {} WITH PASSWORD %s").format(sql.Identifier(db_user)), (db_password,))
        
        # Grant privileges
        print(f"Granting privileges...")
        cursor.execute(sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
            sql.Identifier(db_name), sql.Identifier(db_user)))
        
        cursor.close()
        conn.close()
        
        print("✅ Database setup completed successfully!")
        
        # Return database URL
        return f"postgresql://{db_user}:{db_password}@{default_params['host']}:{default_params['port']}/{db_name}"
        
    except psycopg2.Error as e:
        print(f"❌ Database setup failed: {e}")
        return None

def create_env_file(database_url):
    """Create the .env file with configuration."""
    print("📝 Creating environment configuration...")
    
    env_content = f"""# Database Configuration
DATABASE_URL={database_url}

# Stripe Configuration (Get these from your Stripe dashboard)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Application Configuration
SECRET_KEY={os.urandom(32).hex()}
DEBUG=True
HOST=localhost
PORT=8000

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
"""
    
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print("✅ Environment file created: .env")
    print("⚠️  Please update your Stripe keys in the .env file!")

def install_requirements():
    """Install Python requirements."""
    print("📦 Installing Python requirements...")
    
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        print("✅ Requirements installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install requirements: {e}")
        return False

def create_stripe_products():
    """Instructions for creating Stripe products."""
    print("""
🛍️  Stripe Product Setup Instructions:

1. Go to your Stripe Dashboard (https://dashboard.stripe.com/)
2. Navigate to Products → Add Product
3. Create a product with these details:
   - Name: "LinkedIn Automation Tool - Beta"
   - Pricing Model: Recurring
   - Price: $20.00 USD
   - Billing Period: Monthly
   - Price ID: price_beta_20_monthly (you can set this as the Price ID)

4. Copy the Price ID and update your .env file
5. Set up a webhook endpoint:
   - URL: http://localhost:8000/webhook
   - Events: invoice.payment_succeeded, customer.subscription.deleted

6. Copy the webhook signing secret to your .env file
""")

def main():
    """Main setup function."""
    print("""
🚀 Junior LinkedIn Automation Backend Setup
==========================================

This script will help you set up the backend infrastructure.
Make sure you have PostgreSQL installed and running.
    """)
    
    # Change to backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # Install requirements first
    if not install_requirements():
        print("❌ Setup failed at requirements installation")
        return
    
    # Set up database
    database_url = create_database()
    if not database_url:
        print("❌ Setup failed at database creation")
        return
    
    # Create environment file
    create_env_file(database_url)
    
    # Show Stripe setup instructions
    create_stripe_products()
    
    print("""
✅ Setup completed successfully!

Next steps:
1. Update your Stripe keys in the .env file
2. Set up Stripe products and webhooks (see instructions above)
3. Run the server: python main.py
4. Test the payment flow on your website

Your backend will be available at: http://localhost:8000
API documentation: http://localhost:8000/docs
    """)

if __name__ == "__main__":
    main() 