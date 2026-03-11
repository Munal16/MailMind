$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendScript = Join-Path $PSScriptRoot "start-backend.ps1"
$frontendScript = Join-Path $PSScriptRoot "start-frontend.ps1"

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$backendScript`"" -WorkingDirectory $projectRoot
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$frontendScript`"" -WorkingDirectory $projectRoot

Write-Host "MailMind dev servers launched."
Write-Host "Backend:  http://127.0.0.1:8000/"
Write-Host "Frontend: http://127.0.0.1:5173/"
