$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path ".\backend\.env.production")) {
  throw "Create backend\\.env.production from backend\\.env.production.example before starting production containers."
}

docker compose -f .\docker-compose.prod.yml up --build -d
