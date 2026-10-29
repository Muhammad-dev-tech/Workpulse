@echo off
title WorkPulse - Operational Visibility Platform
color 0B
echo =====================================================================
echo                  WorkPulse - Starting Platform
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js to run WorkPulse.
    pause
    exit /b 1
)

echo [2/3] Launching WorkPulse servers (Backend :5000 and Frontend :3000)...
echo       Starting dev services...

:: Launch the browser after a 4-second delay in background
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

echo.
echo =====================================================================
echo   WorkPulse is running!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5000
echo   Press Ctrl+C in this window at any time to shut down the servers.
echo =====================================================================
echo.

npm run dev
pause
