$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "common.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$pythonExe = Join-Path $backendDir ".venv\\Scripts\\python.exe"

if (-not (Test-Path $pythonExe)) {
  throw "Backend virtual environment is missing at $pythonExe"
}

Stop-PortProcess -Port 8000 -Label "backend"

Set-Location $backendDir
Write-Host "Running Django checks..."
& $pythonExe manage.py check
Write-Host "Applying migrations..."
& $pythonExe manage.py migrate
Write-Host "Starting backend on http://127.0.0.1:8000/"
& $pythonExe manage.py runserver 127.0.0.1:8000
