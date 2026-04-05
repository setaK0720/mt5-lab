@echo off
REM UNCパスから起動された場合のCMD制限を回避
cd /d "%USERPROFILE%"

pushd \\wsl$\NixOS\home\nixos\apps\mt5-lab\backend
if %errorlevel% neq 0 (
    echo ERROR: WSLパスにアクセスできません。WSL^(NixOS^)が起動しているか確認してください。
    pause & exit /b 1
)

py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Install Python from https://python.org
    popd & pause & exit /b 1
)

if not exist .venv (
    echo 仮想環境を作成中...
    py -m venv .venv
    echo パッケージをインストール中...
    .venv\Scripts\pip install -r requirements.txt
)

echo MT5 Lab を起動中 ^(port 8001^)...
.venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8001
popd
pause
