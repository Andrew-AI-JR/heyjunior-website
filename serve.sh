#!/bin/bash
# Simple script to serve the website locally

PORT=${1:-8500}

echo "🚀 Starting local server on port $PORT..."
echo "📂 Serving from: $(pwd)"
echo "🌐 Open in browser: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Try Python 3 first, then Python 2, then Node.js
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer $PORT
elif command -v npx &> /dev/null; then
    npx serve -p $PORT
else
    echo "❌ Error: No suitable server found. Please install Python 3 or Node.js"
    exit 1
fi
