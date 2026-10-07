# Builds the bundled portable Python runtime (runtime\) so Zenith needs NO installation on target PCs.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$RT = Join-Path $Root "runtime"
if (Test-Path (Join-Path $RT "python.exe")) { Write-Host "    [OK] runtime already prepared"; return }

New-Item -ItemType Directory -Path $RT -Force | Out-Null
$zip = Join-Path $env:TEMP "py-embed.zip"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
Invoke-WebRequest "https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip" -OutFile $zip -UseBasicParsing
Expand-Archive $zip -DestinationPath $RT -Force
Remove-Item $zip -Force

# psutil into bundled site-packages (fetches a cp312 win_amd64 wheel with the system pip)
$sp = Join-Path $RT "Lib\site-packages"
New-Item -ItemType Directory -Path $sp -Force | Out-Null
& python -m pip install --quiet --target $sp --only-binary=:all: --platform win_amd64 --python-version 3.12 --implementation cp psutil

# Enable site-packages and project sources in the embedded interpreter
$pth = Join-Path $RT "python312._pth"
Set-Content $pth "python312.zip`r`n.`r`nLib\site-packages`r`n..\src`r`nimport site"
Write-Host "    [OK] Portable runtime ready"
