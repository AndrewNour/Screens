@echo off
title Screens Companion Controller
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "companion.ps1"
pause
