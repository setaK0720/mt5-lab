@echo off
cd /d "%USERPROFILE%"

echo [MT5 Lab] Starting...
echo.

pushd \\wsl$\NixOS\home\nixos\apps\mt5-lab\backend
if %errorlevel% neq 0 goto :err_wsl

echo [OK] %CD%

py --version >nul 2>&1
if %errorlevel% neq 0 goto :err_python

if not exist .venv\Scripts\uvicorn.exe goto :setup
goto :start

:setup
echo [SETUP] Creating virtual environment...
py -m venv .venv
if %errorlevel% neq 0 goto :err_venv
echo [SETUP] Installing packages (this may take a few minutes)...
.venv\Scripts\pip install -r requirements.txt

:start
echo.
echo [OK] Launching uvicorn on port 8001...
echo.
.venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8001
popd
pause
exit /b 0

:err_wsl
echo [ERROR] Cannot access WSL path. Make sure NixOS is running.
pause
exit /b 1

:err_python
echo [ERROR] Python not found. Install from https://python.org
popd
pause
exit /b 1

:err_venv
echo [ERROR] Failed to create virtual environment.
popd
pause
exit /b 1
