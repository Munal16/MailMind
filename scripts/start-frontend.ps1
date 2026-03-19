$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "common.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $projectRoot "frontend"

Stop-PortProcess -Port 5173 -Label "frontend"

Set-Location $frontendDir
Write-Host "Starting frontend on http://127.0.0.1:5173/"
npm run dev
