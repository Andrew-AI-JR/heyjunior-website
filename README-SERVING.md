# How to Serve This Website

This is a **static website** - no build process required! Just serve the files directly.

## Quick Start

### Option 1: Use the provided script (Easiest)
```bash
./serve.sh
# Or specify a port:
./serve.sh 3000
```

### Option 2: Python HTTP Server (Recommended)
```bash
# Python 3
python3 -m http.server 8000

# Python 2 (if Python 3 not available)
python -m SimpleHTTPServer 8000
```

Then open: **http://localhost:8000**

### Option 3: Node.js (if you have Node installed)
```bash
# Using npx serve (no installation needed)
npx serve -p 8000

# Or install serve globally
npm install -g serve
serve -p 8000
```

### Option 4: PHP (if you have PHP installed)
```bash
php -S localhost:8000
```

## Important Notes

### API Configuration
The website connects to a backend API. Make sure:

1. **For local development**: The API should be running on `http://localhost:8001` (or update the API_BASE_URL in the JS files)
2. **For production**: The API should be at `https://api.heyjunior.ai`

The API base URL is configured in:
- `js/checkout.js` (line 82)
- `js/portal.js` (line 4)
- `js/success.js` (line 4)

### Testing the Portal
To test the user portal (`portal.html`):

1. Make sure your backend API is running on port 8001
2. Start the website server (e.g., `python3 -m http.server 8000`)
3. Open `http://localhost:8000/portal.html`
4. You'll see a login form if not authenticated
5. Use valid credentials to test the dashboard

### Production Deployment

This site is typically deployed to:
- **GitHub Pages** (automatic deployment)
- **Netlify** (drag & drop or git integration)
- **Vercel** (git integration)
- Any static hosting service

No build step needed - just upload the files!

## File Structure

```
heyjunior-website/
├── index.html          # Landing page
├── checkout.html       # Payment/account creation
├── portal.html         # User dashboard (NEW!)
├── success.html        # Post-payment success
├── css/
│   └── styles.css      # All styles
├── js/
│   ├── checkout.js     # Checkout logic
│   ├── portal.js       # Portal/dashboard logic (NEW!)
│   └── ...
└── images/             # Images
```

## Troubleshooting

### Port already in use?
```bash
# Use a different port
python3 -m http.server 3000
```

### CORS errors with API?
- Make sure your API server allows requests from `http://localhost:8000`
- Check API CORS configuration

### Portal not loading data?
- Verify API is running on port 8001
- Check browser console for errors
- Verify authentication tokens are being stored
