$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
  throw "Backend venv missing at $pythonExe"
}

Set-Location $backendDir
& $pythonExe manage.py migrate
& $pythonExe manage.py runserver 127.0.0.1:8000
