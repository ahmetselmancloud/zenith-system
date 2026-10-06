@echo off
title Zenith System
cd /d "%~dp0"

:: Self-elevate to Administrator for low-level hardware control (Fans, RGB, MSR, WMI)
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Verify Python is installed and accessible
where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo ==========================================================
        echo [HATA] Python bulunamadi!
        echo Zenith System icin Python 3.10+ gereklidir.
        echo Kurulum icin terminalden su komutu calistirabilirsiniz:
        echo   winget install Python.Python.3.12
        echo ==========================================================
        pause
        exit /b 1
    )
    set "PYTHON_CMD=py"
) else (
    set "PYTHON_CMD=python"
)

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
    start /b "" %PYTHON_CMD% "src\zenith_server.py"
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
