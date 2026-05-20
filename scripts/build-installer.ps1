# One-shot local release builder for MindMapper.
#
# Produces an NSIS installer .exe under:
#   src-tauri/target/release/bundle/nsis/MindMapper_<version>_x64-setup.exe
#
# What it bundles:
#   - MindMapper.exe (Tauri main app, ~12 MB)
#   - WebView2 bootstrap (downloads runtime at first install if missing)
#
# No sidecars, no models — everything runs in-process via reqwest.
#
# Usage:
#   .\scripts\build-installer.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."

Push-Location $root
try {
    Write-Host ">> npm run build (frontend)" -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm build failed" }

    Write-Host ">> tauri build --bundles nsis" -ForegroundColor Cyan
    & "$root\node_modules\.bin\tauri.cmd" build --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw "tauri build failed" }
} finally {
    Pop-Location
}

$nsisDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
$installer = Get-ChildItem $nsisDir -Filter "*.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($installer) {
    Write-Host ""
    Write-Host "done." -ForegroundColor Green
    Write-Host "Installer: $($installer.FullName)" -ForegroundColor Green
    Write-Host ("Size: {0} MB" -f [math]::Round($installer.Length / 1MB, 1)) -ForegroundColor Green
} else {
    Write-Warning "Tauri reported success but no installer found in $nsisDir"
}
