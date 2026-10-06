<#
.SYNOPSIS
    Zenith System — Standalone Release Packager
.DESCRIPTION
    Builds a clean, portable distribution ZIP file ready for GitHub Releases.
#>

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$DistDir = Join-Path $ProjectRoot "dist"
$StagingDir = Join-Path $DistDir "Zenith-System-v1.0.0-win-x64"
$ZipFile = Join-Path $DistDir "Zenith-System-v1.0.0-win-x64.zip"

Write-Host ">>> Cleaning previous build artifacts..." -ForegroundColor Cyan
if (Test-Path $StagingDir) { Remove-Item -Path $StagingDir -Recurse -Force }
if (Test-Path $ZipFile) { Remove-Item -Path $ZipFile -Force }
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

Write-Host ">>> Verifying and compiling native C++ probe (zenith_probe.exe)..." -ForegroundColor Cyan
$ProbeCpp = Join-Path $ProjectRoot "src\zenith_probe.cpp"
$ProbeExe = Join-Path $ProjectRoot "bin\zenith_probe.exe"
if (Get-Command "g++" -ErrorAction SilentlyContinue) {
    & g++ -O3 -std=c++17 $ProbeCpp -o $ProbeExe -lsetupapi
    Write-Host "    [OK] Compiled zenith_probe.exe with g++ -O3" -ForegroundColor Green
}

Write-Host ">>> Compiling native GUI launcher with embedded icon (Zenith.exe)..." -ForegroundColor Cyan
if ((Get-Command "windres" -ErrorAction SilentlyContinue) -and (Get-Command "g++" -ErrorAction SilentlyContinue)) {
    & windres src/zenith.rc -O coff -o src/zenith.res
    & g++ -O3 -mwindows src/zenith_launcher.cpp src/zenith.res -o Zenith.exe -lws2_32
    Write-Host "    [OK] Compiled Zenith.exe with embedded icon" -ForegroundColor Green
}

Write-Host ">>> Staging files into release directory..." -ForegroundColor Cyan
# Copy directories
Copy-Item -Path (Join-Path $ProjectRoot "bin") -Destination $StagingDir -Recurse -Force
Copy-Item -Path (Join-Path $ProjectRoot "src") -Destination $StagingDir -Recurse -Force
Copy-Item -Path (Join-Path $ProjectRoot "web") -Destination $StagingDir -Recurse -Force
if (Test-Path (Join-Path $ProjectRoot "assets")) {
    Copy-Item -Path (Join-Path $ProjectRoot "assets") -Destination $StagingDir -Recurse -Force
}
if (Test-Path (Join-Path $ProjectRoot "catalog")) {
    Copy-Item -Path (Join-Path $ProjectRoot "catalog") -Destination $StagingDir -Recurse -Force
}

# Copy root files
$RootFiles = @("Zenith.exe", "start_zenith.bat", "install.ps1", "README.md", "LICENSE", "hardware_cache.json")
foreach ($rf in $RootFiles) {
    $srcPath = Join-Path $ProjectRoot $rf
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination $StagingDir -Force
    }
}

Write-Host ">>> Compressing into $ZipFile..." -ForegroundColor Cyan
Compress-Archive -Path "$StagingDir\*" -DestinationPath $ZipFile -Force
Remove-Item -Path $StagingDir -Recurse -Force

$SizeMB = (Get-Item $ZipFile).Length / 1MB
$Hash = (Get-FileHash -Path $ZipFile -Algorithm SHA256).Hash

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] Release package built successfully!" -ForegroundColor Green
Write-Host "  - Archive: $ZipFile" -ForegroundColor Green
Write-Host "  - Package Size: $([math]::Round($SizeMB, 2)) MB" -ForegroundColor Green
Write-Host "  - SHA256: $Hash" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
