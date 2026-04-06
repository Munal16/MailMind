$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)
docker compose --env-file .\backend\.env.production -f .\docker-compose.prod.yml down
