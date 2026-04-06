$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path ".\backend\.env.localhost")) {
  throw "backend/.env.localhost does not exist yet."
}

$port = "8080"
foreach ($line in Get-Content -Path ".\backend\.env.localhost") {
  if ($line -match "^MAILMIND_HOST_PORT=(.+)$") {
    $port = $matches[1].Trim()
    break
  }
}

docker compose --env-file .\backend\.env.localhost -f .\docker-compose.local.yml ps

Write-Host ""
Write-Host "MailMind localhost URL: http://127.0.0.1:$port"
