@echo off
echo Starting Techware Automation Servers...
echo.

start "Backend Server" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 3 >nul

start "Frontend Server" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ? Both servers are starting...
echo.
echo Backend:  http://localhost:4000
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this window...
pause >nul
