param([Parameter(Mandatory)][string]$PayloadZip)
# Zenith System - offline installer. Needs only what ships with Windows 10/11 (PowerShell 5.1).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
$InstallDir = Join-Path $env:LOCALAPPDATA "ZenithSystem"
try {
    # Stop a running copy so files can be replaced (only processes living in the install dir)
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($InstallDir, 'OrdinalIgnoreCase') } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Expand-Archive -Path $PayloadZip -DestinationPath $InstallDir -Force
    Get-ChildItem $InstallDir -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

    # Uninstaller
    $un = Join-Path $InstallDir "Uninstall Zenith.cmd"
    Set-Content $un -Encoding ASCII @'
@echo off
echo Removing Zenith System...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | ? { $_.ExecutablePath -and $_.ExecutablePath -like '*\ZenithSystem\*' } | % { Stop-Process -Id $_.ProcessId -Force -EA 0 }; Remove-Item ([Environment]::GetFolderPath('Desktop')+'\Zenith System.lnk'),([Environment]::GetFolderPath('Desktop')+'\Zenith Mini HUD.lnk'),([Environment]::GetFolderPath('Programs')+'\Zenith System.lnk'),([Environment]::GetFolderPath('Programs')+'\Uninstall Zenith.lnk') -EA 0"
cd /d "%TEMP%"
start "" cmd /c "ping 127.0.0.1 -n 3 >nul & rmdir /s /q ""%LOCALAPPDATA%\ZenithSystem"""
'@

    # Shortcuts
    $exe  = Join-Path $InstallDir "Zenith.exe"
    $ws   = New-Object -ComObject WScript.Shell
    function New-Lnk($path, $target, $lnkArgs, $desc, $hotkey) {
        $s = $ws.CreateShortcut($path)
        $s.TargetPath = $target; $s.Arguments = $lnkArgs; $s.WorkingDirectory = $InstallDir
        $s.Description = $desc; $s.IconLocation = "$exe,0"
        if ($hotkey) { $s.Hotkey = $hotkey }
        $s.Save()
    }
    $desk = [Environment]::GetFolderPath('Desktop'); $prog = [Environment]::GetFolderPath('Programs')
    New-Lnk "$desk\Zenith System.lnk"   $exe ""      "Zenith System" "CTRL+ALT+SHIFT+Z"
    New-Lnk "$desk\Zenith Mini HUD.lnk" $exe "--hud" "Zenith Mini HUD" "CTRL+ALT+SHIFT+H"
    New-Lnk "$prog\Zenith System.lnk"   $exe ""      "Zenith System" "CTRL+ALT+SHIFT+Z"
    New-Lnk "$prog\Uninstall Zenith.lnk" $un ""      "Uninstall Zenith System" $null

    Start-Process cmd.exe -ArgumentList "/c","start","""""",("""" + $exe + """") -WorkingDirectory $InstallDir -WindowStyle Hidden
    exit 0
} catch {
    [System.Windows.Forms.MessageBox]::Show("Zenith System setup failed:`n$($_.Exception.Message)", "Zenith Setup", 'OK', 'Error') | Out-Null
    exit 1
}
