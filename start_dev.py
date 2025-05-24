#!/usr/bin/env python3
"""
Development startup script
Starts both the backend API and frontend static server
"""

import subprocess
import sys
import time
import threading
import os
from pathlib import Path

def start_backend():
    """Start the FastAPI backend server."""
    print("🚀 Starting backend server...")
    backend_dir = Path(__file__).parent / "backend"
    os.chdir(backend_dir)
    
    try:
        subprocess.run([sys.executable, "main.py"], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Backend server stopped")
    except Exception as e:
        print(f"❌ Backend server error: {e}")

def start_frontend():
    """Start the frontend static server."""
    print("🌐 Starting frontend server...")
    backend_dir = Path(__file__).parent / "backend"
    
    try:
        subprocess.run([sys.executable, str(backend_dir / "static_server.py")], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Frontend server stopped")
    except Exception as e:
        print(f"❌ Frontend server error: {e}")

def main():
    """Start both servers."""
    print("""
🚀 Junior LinkedIn Automation - Development Server
================================================

Starting both frontend and backend servers...

Frontend: http://localhost:3000
Backend:  http://localhost:8000
API Docs: http://localhost:8000/docs

Press Ctrl+C to stop both servers
    """)
    
    # Start backend in a separate thread
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()
    
    # Give backend time to start
    time.sleep(3)
    
    # Start frontend (this will block until interrupted)
    try:
        start_frontend()
    except KeyboardInterrupt:
        print("\n👋 Shutting down development servers...")

if __name__ == "__main__":
    main() 