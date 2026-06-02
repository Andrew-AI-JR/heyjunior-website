# How to Serve This Website

This is a **static website** - no build process required! Just serve the files directly.

## Quick Start

### Option 1: Use the provided script (Easiest)
```bash
./serve.sh
# Defaults: site :8002, API :8001
./serve.sh
./serve.sh 8000 9000

./serve.sh --help
```

`serve.sh` writes `js/api-config.local.js` so the site calls your API on the port you pass (second argument). That file is removed when you stop the server.

### Option 2: Python HTTP Server
```bash
# With security headers (same as ./serve.sh)
python3 scripts/static_server.py 8000

# Plain server (no extra headers)
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
Use **`./serve.sh [site-port] [api-port]`** — the second argument is your backend API port (default **8001**). The script writes `js/api-config.local.js` for the browser.

Production uses `https://api.heyjunior.ai` automatically (not localhost).

Manual override (without serve.sh): copy `js/api-config.local.example.js` to `js/api-config.local.js` and edit.

### Testing the Portal
To test the user portal (`portal.html`):

1. Make sure your backend API is running on port 8001
2. Start the website server (`./serve.sh` → http://localhost:8002)
3. Open `http://localhost:8002/portal.html`
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

## Security headers (clickjacking)

Production is on **GitHub Pages**, which does not let you set custom HTTP response headers from the repo. This project uses two layers:

1. **`js/frame-guard.js`** on account-sensitive pages (login, checkout, register, password reset, partner dashboard). Loaded early in `<head>` so the page breaks out of hostile iframes.
2. **`./serve.sh`** uses `scripts/static_server.py` locally so you get `X-Frame-Options` and `Content-Security-Policy: frame-ancestors 'self'` while developing.

### Cloudflare (recommended for production)

The site already uses Cloudflare (Web Analytics on checkout). In the Cloudflare dashboard for **heyjunior.ai**:

1. **Rules** → **Transform Rules** → **Modify Response Header**
2. Create a rule for hostname `heyjunior.ai` (and `www` if used)
3. Set headers:
   - `X-Frame-Options`: `SAMEORIGIN`
   - `Content-Security-Policy`: `frame-ancestors 'self'`

That is stronger than frame-busting JavaScript alone. Keep `frame-guard.js` as defense in depth.

If you move to **Netlify** or **Cloudflare Pages**, the repo root `_headers` file applies the same headers automatically.

## Troubleshooting

### Port already in use?
```bash
# Use a different port
python3 -m http.server 3000
```

### CORS errors with API?
The browser sends the **full origin**, not just `localhost`. If the site is on port **8002**, allow:

- `http://localhost:8002`
- `http://127.0.0.1:8002`

`http://localhost` alone is not enough. CORS must be set on **OPTIONS** preflight and on error responses (400/422), or the browser hides the real API error.

Analytics uses the same API host as everything else (`getApiBaseUrl()` → port **8001** by default). Old hardcoded port **8080** was wrong for local dev.

### Portal not loading data?
- Verify API is running on port 8001
- Check browser console for errors
- Verify authentication tokens are being stored
