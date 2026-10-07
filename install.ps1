<#
.SYNOPSIS
    Zenith System — One-Line Global PowerShell Installer
.DESCRIPTION
    Installs Zenith System to %LOCALAPPDATA%\ZenithSystem, configures dependencies,
    creates Desktop and Start Menu shortcuts, and launches the application.
.EXAMPLE
    irm https://raw.githubusercontent.com/ahmetselmancloud/zenith-system/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "   ZENITH SYSTEM - Global Windows Monitor & Assistant" -ForegroundColor Cyan
Write-Host "   Zero-Bloat | <250ms Cold Boot | Native C++ Core | No Zombies" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$InstallDir = Join-Path $env:LOCALAPPDATA "ZenithSystem"
$RepoOwner = "ahmetselmancloud"
$RepoName = "zenith-system"
$ZipUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/master.zip"
$TempZip = Join-Path $env:TEMP "zenith-system.zip"

# 1. Check Python installation
Write-Host "[1/5] Checking Python runtime..." -ForegroundColor Yellow
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) {
    $PythonCmd = Get-Command py -ErrorAction SilentlyContinue
}

if (-not $PythonCmd) {
    Write-Host "      Python not found. Attempting automatic installation..." -ForegroundColor Gray
    try {
        $Installed = $false
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            Write-Host "      [Setup] Installing Python 3.12 via WinGet..." -ForegroundColor Gray
            & winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
            $Installed = $true
        }
        
        if (-not $Installed -or -not (Get-Command python -ErrorAction SilentlyContinue)) {
            Write-Host "      [Setup] Downloading Python 3.12 installer directly..." -ForegroundColor Gray
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
            $PyInstaller = Join-Path $env:TEMP "python-3.12-installer.exe"
            Invoke-WebRequest "https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe" -OutFile $PyInstaller -UseBasicParsing
            Start-Process $PyInstaller -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 SimpleInstall=1" -Wait
            Remove-Item $PyInstaller -Force -ErrorAction SilentlyContinue
        }

        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $PythonCmd = Get-Command python -ErrorAction SilentlyContinue
        if (-not $PythonCmd) { $PythonCmd = Get-Command py -ErrorAction SilentlyContinue }
        if (-not $PythonCmd) {
            $CandidatePaths = @(
                "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
                "$env:ProgramFiles\Python312\python.exe",
                "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
            )
            foreach ($cand in $CandidatePaths) {
                if (Test-Path $cand) {
                    $env:Path += ";$(Split-Path $cand)"
                    $PythonCmd = Get-Command $cand -ErrorAction SilentlyContinue
                    break
                }
            }
        }
        Write-Host "      [OK] Python configured successfully." -ForegroundColor Green
    } catch {
        Write-Warning "Could not install Python automatically: $_"
    }
} else {
    Write-Host "      [OK] Python detected: $($PythonCmd.Source)" -ForegroundColor Green
}

# 2. Check and install Python dependencies
Write-Host "[2/5] Ensuring required Python libraries (psutil)..." -ForegroundColor Yellow
try {
    $PyExec = if ($PythonCmd) { $PythonCmd.Source } else { "python" }
    & $PyExec -m pip install --quiet psutil
    Write-Host "      [OK] Dependencies up to date." -ForegroundColor Green
} catch {
    Write-Warning "Could not install psutil via pip. Telemetry may be limited."
}

# 3. Download or Synchronize Project Files
Write-Host "[3/5] Deploying Zenith System to $InstallDir..." -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$CurrentScriptDir = $PSScriptRoot
if ($CurrentScriptDir -and (Test-Path (Join-Path $CurrentScriptDir "start_zenith.bat"))) {
    Write-Host "      Installing from local repository files..." -ForegroundColor Gray
    Copy-Item -Path "$CurrentScriptDir\*" -Destination $InstallDir -Recurse -Force
} else {
    Write-Host "      Downloading latest release from GitHub ($ZipUrl)..." -ForegroundColor Gray
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        Invoke-WebRequest -Uri $ZipUrl -OutFile $TempZip -UseBasicParsing
        Expand-Archive -Path $TempZip -DestinationPath $env:TEMP -Force
        $ExtractedFolder = Join-Path $env:TEMP "zenith-system-master"
        if (-not (Test-Path $ExtractedFolder)) {
            $ExtractedFolder = Join-Path $env:TEMP "zenith-system-main"
        }
        Copy-Item -Path "$ExtractedFolder\*" -Destination $InstallDir -Recurse -Force
        Remove-Item -Path $TempZip -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $ExtractedFolder -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Error "Failed to download Zenith System from GitHub: $_"
        return
    }
}
Write-Host "      [OK] Files deployed successfully." -ForegroundColor Green

# 4. Create Desktop & Start Menu Shortcuts
Write-Host "[4/5] Creating Windows Shortcuts..." -ForegroundColor Yellow
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $TargetExe = Join-Path $InstallDir "Zenith.exe"
    $TargetApp = if (Test-Path $TargetExe) { $TargetExe } else { Join-Path $InstallDir "start_zenith.bat" }
    $IconPath = if (Test-Path $TargetExe) { "$TargetExe,0" } elseif (Test-Path (Join-Path $InstallDir "assets\zenith.ico")) { Join-Path $InstallDir "assets\zenith.ico" } else { "$env:SystemRoot\System32\shell32.dll,15" }
    
    # Desktop Shortcut
    $DesktopFolder = [System.Environment]::GetFolderPath('Desktop')
    $DesktopLnk = Join-Path $DesktopFolder "Zenith System.lnk"
    $Shortcut = $WshShell.CreateShortcut($DesktopLnk)
    $Shortcut.TargetPath = $TargetApp
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Zenith System - Next-Gen Hardware Monitor (Hotkey: Ctrl+Alt+Shift+Z)"
    $Shortcut.Hotkey = "CTRL+ALT+SHIFT+Z"
    $Shortcut.WindowStyle = 1
    $Shortcut.IconLocation = $IconPath
    $Shortcut.Save()
    Write-Host "      [OK] Desktop shortcut created (Hotkey: Ctrl+Alt+Shift+Z): $DesktopLnk" -ForegroundColor Green

    # Desktop Mini HUD Shortcut
    $HudLnk = Join-Path $DesktopFolder "Zenith Mini HUD.lnk"
    $HudShortcut = $WshShell.CreateShortcut($HudLnk)
    $HudShortcut.TargetPath = $TargetApp
    $HudShortcut.Arguments = "--hud"
    $HudShortcut.WorkingDirectory = $InstallDir
    $HudShortcut.Description = "Zenith Mini HUD - Floating Desktop Hardware Widget (Hotkey: Ctrl+Alt+Shift+H)"
    $HudShortcut.Hotkey = "CTRL+ALT+SHIFT+H"
    $HudShortcut.WindowStyle = 1
    $HudShortcut.IconLocation = $IconPath
    $HudShortcut.Save()
    Write-Host "      [OK] Mini HUD shortcut created (Hotkey: Ctrl+Alt+Shift+H): $HudLnk" -ForegroundColor Green

    # Start Menu Shortcut
    $StartMenuPrograms = [System.Environment]::GetFolderPath('Programs')
    if (Test-Path $StartMenuPrograms) {
        $StartMenuLnk = Join-Path $StartMenuPrograms "Zenith System.lnk"
        $SMShortcut = $WshShell.CreateShortcut($StartMenuLnk)
        $SMShortcut.TargetPath = $TargetApp
        $SMShortcut.WorkingDirectory = $InstallDir
        $SMShortcut.Description = "Zenith System - Next-Gen Hardware Monitor (Hotkey: Ctrl+Alt+Shift+Z)"
        $SMShortcut.Hotkey = "CTRL+ALT+SHIFT+Z"
        $SMShortcut.WindowStyle = 1
        $SMShortcut.IconLocation = $IconPath
        $SMShortcut.Save()
        Write-Host "      [OK] Start Menu shortcut created: $StartMenuLnk" -ForegroundColor Green
    }
} catch {
    Write-Warning "Could not create desktop shortcuts automatically: $_"
}

# 5. Launch Zenith System
Write-Host "[5/5] Launching Zenith System..." -ForegroundColor Yellow
Start-Process -FilePath (Join-Path $InstallDir "start_zenith.bat") -WorkingDirectory $InstallDir

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "   Zenith System is successfully installed and running!" -ForegroundColor Green
Write-Host "   - Open anytime from your Desktop or Start Menu shortcut." -ForegroundColor Green
Write-Host "   - GitHub: https://github.com/$RepoOwner/$RepoName" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
