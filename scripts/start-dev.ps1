$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "common.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendScript = Join-Path $PSScriptRoot "start-backend.ps1"
$frontendScript = Join-Path $PSScriptRoot "start-frontend.ps1"
$powershellExe = (Get-Command powershell.exe).Source

Write-Host "Launching MailMind backend..."
$backendProcess = Start-Process $powershellExe -ArgumentList "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$backendScript`"" -WorkingDirectory $projectRoot -PassThru

if (-not (Wait-ForHttp -Url "http://127.0.0.1:8000/" -TimeoutSeconds 90)) {
  throw "Backend did not become ready on http://127.0.0.1:8000/"
}

Write-Host "Launching MailMind frontend..."
$frontendProcess = Start-Process $powershellExe -ArgumentList "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$frontendScript`"" -WorkingDirectory $projectRoot -PassThru

if (-not (Wait-ForHttp -Url "http://127.0.0.1:5173/" -TimeoutSeconds 90)) {
  throw "Frontend did not become ready on http://127.0.0.1:5173/"
}

Write-Host ""
Write-Host "MailMind dev servers are running."
Write-Host "Backend:  http://127.0.0.1:8000/"
Write-Host "Frontend: http://127.0.0.1:5173/"
Write-Host "Backend PID:  $($backendProcess.Id)"
Write-Host "Frontend PID: $($frontendProcess.Id)"
