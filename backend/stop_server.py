#!/usr/bin/env python3
"""
Stop the background payment server
"""

import os
import sys
from pathlib import Path

def stop_server():
    """Stop the background server using saved PID"""
    script_dir = Path(__file__).parent
    pid_file = script_dir / "server.pid"
    
    if not pid_file.exists():
        print("❌ No server PID file found. Server may not be running.")
        return False
    
    try:
        with open(pid_file, 'r') as f:
            pid = int(f.read().strip())
        
        # Kill the process
        if sys.platform == "win32":
            os.system(f"taskkill /F /PID {pid}")
        else:
            os.kill(pid, 9)
        
        # Remove PID file
        pid_file.unlink()
        
        print(f"🛑 Server stopped (PID: {pid})")
        return True
        
    except (ValueError, ProcessLookupError, OSError) as e:
        print(f"❌ Error stopping server: {e}")
        # Clean up PID file anyway
        if pid_file.exists():
            pid_file.unlink()
        return False

if __name__ == "__main__":
    stop_server() 