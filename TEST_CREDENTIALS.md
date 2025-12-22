# Test User Credentials

## Creating a Test Account

To test the portal login functionality, you need to create a test account first.

### Option 1: Via Checkout Page (Recommended)

1. Go to `http://localhost:8500/checkout.html`
2. Fill in the form:
   - **Email**: `test@example.com` (or any email you want)
   - **Password**: `TestPassword123` (must have at least 8 characters and one uppercase letter)
   - **Confirm Password**: `TestPassword123`
   - Select a platform (Windows or macOS)
   - Select a plan (Standard or Pro)
3. Click "Continue to Payment"
4. Complete the checkout flow (you can use test mode in Stripe)
5. After successful registration, you can login at `http://localhost:8500/portal.html`

### Option 2: Direct API Registration

If your backend API supports it, you can register directly:

```bash
curl -X POST http://localhost:8001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

### Test Credentials (if account already exists)

If you've already created a test account:

- **Email**: `test@example.com`
- **Password**: `TestPassword123`

**Note**: Password requirements:
- Minimum 8 characters
- At least one uppercase letter
- Example: `TestPassword123`, `MyTest123`, `Password1`

### Testing Login

1. Navigate to `http://localhost:8500/portal.html`
2. Enter your test credentials
3. Click "Login"
4. You should see the dashboard with:
   - Account information
   - Subscription details (if you have one)
   - Usage statistics
   - Referral link and count

### Troubleshooting

- **"Login failed"**: Check that the account exists and password is correct
- **"No authentication token"**: Make sure the API is running on port 8001
- **CORS errors**: Ensure your API allows requests from `http://localhost:8500`
