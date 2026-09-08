# Start Backend
Write-Host '🚀 Starting Backend Server...' -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd \"c:\Users\DELL\OneDrive\Desktop\Techware projects\Techware-Automation-Portfolio\AutoCard-Clean\backend\"; npm run dev'

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start Frontend
Write-Host '🚀 Starting Frontend Server...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd \"c:\Users\DELL\OneDrive\Desktop\Techware projects\Techware-Automation-Portfolio\AutoCard-Clean\frontend\"; npm run dev'

Write-Host '✅ Servers are starting in separate windows!' -ForegroundColor Yellow
Write-Host '📍 Backend: http://localhost:4000' -ForegroundColor Green
Write-Host '📍 Frontend: http://localhost:5173' -ForegroundColor Cyan
