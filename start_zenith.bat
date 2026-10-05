@echo off
title Zenith System
cd /d "%~dp0"

:: Check if server is already running on port 49152
netstat -ano | findstr 127.0.0.1:49152 | findstr LISTENING > nul
if errorlevel 1 (
    :: Run initial hardware probe if cache does not exist
    if not exist "hardware_cache.json" (
        if exist "bin\zenith_probe.exe" (
            "bin\zenith_probe.exe" > nul
        )
    )
    :: Start python backend server silently
    start /b "" python "src\zenith_server.py"
    :: Brief delay for port bind
    powershell -nop -c "Start-Sleep -Milliseconds 400"
)

:: Focus or launch dedicated frameless app window using available Chromium browser
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

echo [Zenith] Window activated at %APP_URL%
