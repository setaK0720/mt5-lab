@echo off
cd /d "%USERPROFILE%"

echo [MT5 Lab] Starting...
echo.

pushd \\wsl$\NixOS\home\nixos\apps\mt5-lab\backend
if %errorlevel% neq 0 (
    echo [ERROR] Cannot access WSL path.
    echo         Make sure WSL (NixOS) is running.
    pause
    exit /b 1
)

echo [OK] Working directory: %CD%

py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install from https://python.org
    popd
    pause
    exit /b 1
)

if not exist .venv (
    echo [SETUP] Creating virtual environment...
    py -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create venv.
        popd
        pause
        exit /b 1
    )
    echo [SETUP] Installing packages...
    .venv\Scripts\pip install -r requirements.txt
)

echo [OK] Starting uvicorn on port 8001...
echo.
.venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8001

popd
pause
