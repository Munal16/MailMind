$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "common.ps1")

$backendPids = Get-ListeningPids -Port 8000
$frontendPids = Get-ListeningPids -Port 5173

if ($backendPids.Count -gt 0) {
  Write-Host "Backend is listening on http://127.0.0.1:8000/ (PID: $($backendPids -join ', '))"
} else {
  Write-Host "Backend is not running on port 8000."
}

if ($frontendPids.Count -gt 0) {
  Write-Host "Frontend is listening on http://127.0.0.1:5173/ (PID: $($frontendPids -join ', '))"
} else {
  Write-Host "Frontend is not running on port 5173."
}
