@echo off
chcp 65001 >nul
title Talking Avatar 3D - Proiect Grafica pe Calculator (Student: Jipeanu Viorel)
cls
echo =================================================================
echo   Talking Avatar 3D - Proiect Grafica pe Calculator
echo   Student: Jipeanu Viorel
echo =================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_server.ps1"
pause
