$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path ".\backend\.env.localhost")) {
  throw "backend/.env.localhost does not exist yet."
}

docker compose --env-file .\backend\.env.localhost -f .\docker-compose.local.yml down
