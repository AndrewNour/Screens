@echo off
title Screens Local Controller
cd /d "%~dp0"

echo [1/3] Starting local server...
start /b node back/server.js

echo [2/3] Waiting for server to start...
timeout /t 3 >nul

echo [3/3] Opening screens display in default browser...
start "" "http://localhost:7860/screens"

echo Launching companion script in the background...
start "" powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "front/companion.ps1"

echo Done! Server and controller are active.
echo This window will close in 3 seconds.
timeout /t 3 >nul
exit
