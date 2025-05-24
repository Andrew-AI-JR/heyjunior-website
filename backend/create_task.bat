@echo off
echo Creating Windows Task Scheduler entry...

set BACKEND_DIR=%~dp0
set PYTHON_EXE=pythonw.exe
set SCRIPT_PATH=%BACKEND_DIR%simple_server.py

schtasks /create /tn "Junior Payment Server" /tr "%PYTHON_EXE% \"%SCRIPT_PATH%\"" /sc onstart /ru SYSTEM /f

echo Task created! Server will auto-start on Windows boot.
echo To start now: schtasks /run /tn "Junior Payment Server"
echo To stop: schtasks /end /tn "Junior Payment Server"
echo To delete: schtasks /delete /tn "Junior Payment Server" /f

pause 