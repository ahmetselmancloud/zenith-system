@echo off
title Zenith System
cd /d "D:\Antigravity\zenith-system"

:: Run native hardware probe once if cache doesn't exist
if not exist "hardware_cache.json" (
    echo [Zenith] Ilk donanim taramasi yapiliyor...
    "bin\zenith_probe.exe" > nul
)

:: Start python backend server in background
start /b "" python "src\zenith_server.py"

:: Wait 500ms for server to bind
timeout /t 1 /nobreak > nul

:: Open dedicated frameless app window using Brave or Edge
set BRAVE_PATH="%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"
set EDGE_PATH="C:\Program Files (x86)\Microsoft\EdgeCore\154.0.4258.53\msedge.exe"

if exist %BRAVE_PATH% (
    start "" %BRAVE_PATH% --app="http://127.0.0.1:49152" --window-size=1240,820
) else if exist %EDGE_PATH% (
    start "" %EDGE_PATH% --app="http://127.0.0.1:49152" --window-size=1240,820
) else (
    start http://127.0.0.1:49152
)

echo [Zenith] Uygulama basariyla acildi!
