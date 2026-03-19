$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "common.ps1")

Stop-PortProcess -Port 8000 -Label "backend"
Stop-PortProcess -Port 5173 -Label "frontend"

Write-Host "MailMind dev servers have been stopped."
