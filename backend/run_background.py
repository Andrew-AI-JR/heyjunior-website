#!/usr/bin/env python3
"""
Background runner for the payment server
Starts the server and detaches from console
"""

import subprocess
import sys
import os
from pathlib import Path

def start_background_server():
    """Start the server in the background"""
    script_dir = Path(__file__).parent
    server_script = script_dir / "simple_server.py"
    
    # Start the server as a detached process
    if sys.platform == "win32":
        # Windows: Use CREATE_NEW_PROCESS_GROUP and DETACHED_PROCESS
        process = subprocess.Popen(
            [sys.executable, str(server_script)],
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
            cwd=script_dir
        )
    else:
        # Unix-like systems
        process = subprocess.Popen(
            [sys.executable, str(server_script)],
            cwd=script_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    
    print(f"🚀 Server started in background with PID: {process.pid}")
    print(f"💳 Payment server available at: http://localhost:8000")
    print(f"❤️  Health check: http://localhost:8000/health")
    print(f"🔧 Test endpoint: http://localhost:8000/test")
    
    # Save PID for later stopping
    pid_file = script_dir / "server.pid"
    with open(pid_file, 'w') as f:
        f.write(str(process.pid))
    
    print(f"📝 PID saved to: {pid_file}")
    return process.pid

if __name__ == "__main__":
    start_background_server() 