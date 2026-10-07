<#
.SYNOPSIS  Builds dist\Zenith-Setup-v1.0.0-x64.exe: a single-file offline installer (embeds the portable zip).
.NOTES     Needs g++/windres (same toolchain build_dist.ps1 uses). Run build_dist.ps1 first so the zip is current.
#>
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Zip  = Join-Path $Root "dist\Zenith-System-v1.0.0-win-x64.zip"
$Out  = Join-Path $Root "dist\Zenith-Setup-v1.0.0-x64.exe"
if (-not (Test-Path $Zip)) { throw "Missing $Zip - run build_dist.ps1 first." }

$Work = Join-Path $env:TEMP "zenith-setup-build"
if (Test-Path $Work) { Remove-Item $Work -Recurse -Force }
New-Item -ItemType Directory $Work | Out-Null
Copy-Item $Zip (Join-Path $Work "payload.zip")
Copy-Item (Join-Path $Root "installer\setup_zenith.ps1") $Work
Copy-Item (Join-Path $Root "installer\setup_stub.cpp") $Work
Copy-Item (Join-Path $Root "assets\zenith.ico") $Work
Set-Content (Join-Path $Work "setup.rc") -Encoding ASCII @'
1 RCDATA "payload.zip"
2 RCDATA "setup_zenith.ps1"
3 ICON "zenith.ico"
'@
Push-Location $Work
try {
    & windres setup.rc -O coff -o setup.res
    & g++ -O2 -mwindows -static setup_stub.cpp setup.res -o $Out
    if ($LASTEXITCODE -ne 0) { throw "g++ failed" }
} finally { Pop-Location }
Remove-Item $Work -Recurse -Force
"{0}  {1:N1} MB  SHA256 {2}" -f $Out, ((Get-Item $Out).Length/1MB), (Get-FileHash $Out).Hash
