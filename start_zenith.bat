@echo off
title Zenith System
cd /d "%~dp0"

:: Self-elevate to Administrator for low-level hardware control (Fans, RGB, MSR, WMI)
net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Check if Python is available, otherwise auto-install silently via winget or embedded bootstrap
set "PYTHON_CMD="
where python >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=python"
if "%PYTHON_CMD%"=="" (
    where py >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=py"
)

:: If Python is not on PATH, check default Windows installation paths
if "%PYTHON_CMD%"=="" (
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    if exist "%ProgramFiles%\Python312\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python312\python.exe"
    if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    if exist "%ProgramFiles%\Python313\python.exe" set "PYTHON_CMD=%ProgramFiles%\Python313\python.exe"
)

:: If still missing, automatically install Python 3.12 silently via winget
if "%PYTHON_CMD%"=="" (
    echo ================================================================
    echo  [Zenith Setup] Initializing lightweight runtime environment...
    echo  Please wait a moment while components are configured...
    echo ================================================================
    where winget >nul 2>nul
    if not errorlevel 1 (
        winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
        if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
            set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        ) else if exist "%ProgramFiles%\Python312\python.exe" (
            set "PYTHON_CMD=%ProgramFiles%\Python312\python.exe"
        ) else (
            set "PYTHON_CMD=python"
        )
    ) else (
        echo [NOTICE] Downloading portable runtime...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $installer = Join-Path $env:TEMP 'python_installer.exe'; Invoke-WebRequest 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' -OutFile $installer; Start-Process $installer -ArgumentList '/quiet InstallAllUsers=0 PrependPath=1 SimpleInstall=1' -Wait; Remove-Item $installer -Force -ErrorAction SilentlyContinue"
        if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
            set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        ) else (
            set "PYTHON_CMD=python"
        )
    )
)

:: Ensure psutil is installed silently
%PYTHON_CMD% -c "import psutil" >nul 2>nul
if errorlevel 1 (
    echo [Zenith Setup] Finalizing hardware probe libraries...
    %PYTHON_CMD% -m pip install --quiet psutil >nul 2>nul
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
