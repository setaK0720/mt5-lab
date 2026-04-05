@echo off
pushd \\wsl$\NixOS\home\nixos\apps\mt5-lab\backend

py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Install Python from https://python.org
    popd & pause & exit /b 1
)

if not exist .venv (
    py -m venv .venv
    .venv\Scripts\pip install -r requirements.txt
)
.venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8001
popd
pause
