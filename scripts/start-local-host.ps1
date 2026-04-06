$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  throw "Docker Desktop is required for localhost hosting. Install Docker Desktop, start it once, then rerun this script."
}

& (Join-Path $PSScriptRoot "setup-local-hosting.ps1")

$envPath = ".\backend\.env.localhost"
if (-not (Test-Path $envPath)) {
  throw "Localhost config was not created. Check backend/.env.localhost."
}

$port = "8080"
foreach ($line in Get-Content -Path $envPath) {
  if ($line -match "^MAILMIND_HOST_PORT=(.+)$") {
    $port = $matches[1].Trim()
    break
  }
}

docker compose --env-file .\backend\.env.localhost -f .\docker-compose.local.yml up --build -d

$lanIp = $null
try {
  $lanIp = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254*" } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
} catch {
  $lanIp = $null
}

Write-Host ""
Write-Host "MailMind localhost hosting is running."
Write-Host "Open on this machine: http://127.0.0.1:$port"
Write-Host "Also available on:     http://localhost:$port"
if ($lanIp) {
  Write-Host "Same Wi-Fi access:     http://$lanIp`:$port"
  Write-Host "Note: Gmail OAuth over a LAN URL needs matching Google OAuth redirect/origin settings."
}
