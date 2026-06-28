# Build script — produces two self-contained Windows executables (no console window)
# Usage: .\build.ps1
# Output: dist\savicar\savicar.exe  and  dist\badencar\badencar.exe

$ErrorActionPreference = "Stop"
$apiDir = "$PSScriptRoot\savicar-api"
$outDir = "$PSScriptRoot\dist"
$rsrc   = "$(go env GOPATH)\bin\rsrc.exe"

# Ensure rsrc is installed
if (-not (Test-Path $rsrc)) {
    Write-Host "==> Installing rsrc..."
    go install github.com/akavel/rsrc@latest
}

Write-Host "==> Building savicar-web frontend..."
cd "$PSScriptRoot\savicar-web"
npm run build | Out-Null

Write-Host "==> Building badencar-web frontend..."
cd "$PSScriptRoot\..\badencar\badencar-web"
npm run build | Out-Null

# Generate .ico from embedded logo and embed as Windows resource (.syso)
Write-Host "==> Embedding executable icon..."
cd $apiDir
go run ./cmd/mkico "$apiDir\app.ico"
& $rsrc -ico "$apiDir\app.ico" -o "$apiDir\rsrc.syso"

# ── savicar package ──────────────────────────────────────────────
Write-Host "==> Packaging savicar..."
Remove-Item -Recurse -Force "$apiDir\dist" -ErrorAction SilentlyContinue
Copy-Item -Recurse "$PSScriptRoot\savicar-web\dist" "$apiDir\dist"

New-Item -ItemType Directory -Force "$outDir\savicar" | Out-Null
cd $apiDir
go build -ldflags "-H windowsgui -s -w" -o "$outDir\savicar\savicar.exe" .

# ── badencar package ─────────────────────────────────────────────
Write-Host "==> Packaging badencar..."
Remove-Item -Recurse -Force "$apiDir\dist" -ErrorAction SilentlyContinue
Copy-Item -Recurse "$PSScriptRoot\..\badencar\badencar-web\dist" "$apiDir\dist"

New-Item -ItemType Directory -Force "$outDir\badencar" | Out-Null
cd $apiDir
go build -ldflags "-H windowsgui -s -w" -o "$outDir\badencar\badencar.exe" .

# ── clean up temp files ──────────────────────────────────────────
Remove-Item "$apiDir\app.ico",  "$apiDir\rsrc.syso" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$apiDir\dist" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$apiDir\dist" | Out-Null
Set-Content "$apiDir\dist\index.html" "<!doctype html><html><body>build placeholder</body></html>"

Write-Host ""
Write-Host "Done!"
Write-Host "  dist\savicar\savicar.exe"
Write-Host "  dist\badencar\badencar.exe"
Get-ChildItem "$outDir\savicar", "$outDir\badencar" -Filter "*.exe" |
    Select-Object FullName, @{N="MB";E={[math]::Round($_.Length/1MB,1)}}
