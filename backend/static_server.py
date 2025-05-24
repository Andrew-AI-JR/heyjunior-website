#!/usr/bin/env python3
"""
Simple static file server for development
Serves the frontend files with proper CORS headers
"""

import http.server
import socketserver
import os
from pathlib import Path

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def start_server(port=3000):
    """Start the static file server."""
    # Change to the parent directory (where the HTML files are)
    os.chdir(Path(__file__).parent.parent)
    
    print(f"Starting static file server on port {port}")
    print(f"Serving files from: {os.getcwd()}")
    print(f"Frontend available at: http://localhost:{port}")
    print("Press Ctrl+C to stop the server")
    
    with socketserver.TCPServer(("", port), CORSRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    start_server() 