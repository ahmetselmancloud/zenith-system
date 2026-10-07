<#
.SYNOPSIS  Builds dist\Zenith-Setup-v1.0.0-x64.exe with Inno Setup from the portable zip.
.NOTES     Needs Inno Setup 6 (winget install JRSoftware.InnoSetup). Run build_dist.ps1 first.
#>
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Zip  = Join-Path $Root "dist\Zenith-System-v1.0.0-win-x64.zip"
if (-not (Test-Path $Zip)) { throw "Missing $Zip - run build_dist.ps1 first." }
$iscc = @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { $c = Get-Command ISCC.exe -ErrorAction SilentlyContinue; if ($c) { $iscc = $c.Source } }
if (-not $iscc) { throw "Inno Setup 6 not found." }

$Stage = Join-Path $env:TEMP "zenith-setup-stage"
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
Expand-Archive $Zip $Stage
$Out = Join-Path $Root "dist"
& $iscc "/DStage=$Stage" "/DOutDir=$Out" (Join-Path $Root "installer\zenith.iss")
if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }
Remove-Item $Stage -Recurse -Force
$exe = Join-Path $Out "Zenith-Setup-v1.0.0-x64.exe"
"{0}  {1:N1} MB  SHA256 {2}" -f $exe, ((Get-Item $exe).Length/1MB), (Get-FileHash $exe).Hash
