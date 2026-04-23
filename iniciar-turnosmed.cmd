@echo off
cd /d C:\turnosmed
start cmd /k "cd /d C:\turnosmed\server && node index.js"
start cmd /k "cd /d C:\turnosmed\client && npm run dev"
timeout /t 5 >nul
start http://localhost:5173/