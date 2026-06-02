#!/usr/bin/env python3
"""Static file server with security headers (local dev)."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys


class SecureStaticHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Content-Security-Policy', "frame-ancestors 'self'")
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    server = ThreadingHTTPServer(('', port), SecureStaticHandler)
    print(f'Serving with security headers on http://localhost:{port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
