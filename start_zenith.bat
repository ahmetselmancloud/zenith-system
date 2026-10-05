@echo off
title Zenith System
cd /d "%~dp0"

:: Run native hardware probe once if cache doesn't exist
if not exist "hardware_cache.json" (
    echo [Zenith] Initializing hardware probe...
    if exist "bin\zenith_probe.exe" (
        "bin\zenith_probe.exe" > nul
    )
)

:: Start python backend server in background
start /b "" python "src\zenith_server.py"

:: Wait 1 second for port 49152 to bind
timeout /t 1 /nobreak > nul

:: Open dedicated frameless app window using available Chromium browser
set APP_URL=http://127.0.0.1:49152
set APP_FLAGS=--app=%APP_URL% --window-size=1240,820

if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" %APP_FLAGS%
) else if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" %APP_FLAGS%
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" %APP_FLAGS%
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" %APP_FLAGS%
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" %APP_FLAGS%
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" %APP_FLAGS%
) else (
    start %APP_URL%
)

echo [Zenith] System active at %APP_URL%
