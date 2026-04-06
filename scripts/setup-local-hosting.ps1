$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

$envPath = ".\backend\.env.localhost"
$sourceEnvPath = ".\backend\.env"
$templateEnvPath = ".\backend\.env.localhost.example"

function Read-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $values = @{}
  if (-not (Test-Path $Path)) {
    return $values
  }

  foreach ($line in Get-Content -Path $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) {
      continue
    }

    $values[$parts[0].Trim()] = $parts[1].Trim()
  }

  return $values
}

function New-RandomSecret {
  $left = [guid]::NewGuid().ToString("N")
  $right = [guid]::NewGuid().ToString("N")
  return "$left$right"
}

if (Test-Path $envPath) {
  Write-Host "Local hosting config already exists at backend/.env.localhost"
  exit 0
}

$seed = @{}
if (Test-Path $sourceEnvPath) {
  $seed = Read-EnvFile -Path $sourceEnvPath
  Write-Host "Using backend/.env as the base for localhost hosting."
} elseif (Test-Path $templateEnvPath) {
  $seed = Read-EnvFile -Path $templateEnvPath
  Write-Host "Using backend/.env.localhost.example as the base for localhost hosting."
} else {
  throw "Could not find backend/.env or backend/.env.localhost.example to generate localhost hosting config."
}

$port = "8080"
$secretKey = if ($seed.ContainsKey("SECRET_KEY") -and $seed["SECRET_KEY"]) { $seed["SECRET_KEY"] } else { New-RandomSecret }
$googleClientId = if ($seed.ContainsKey("GOOGLE_CLIENT_ID")) { $seed["GOOGLE_CLIENT_ID"] } else { "replace-with-google-client-id" }
$googleClientSecret = if ($seed.ContainsKey("GOOGLE_CLIENT_SECRET")) { $seed["GOOGLE_CLIENT_SECRET"] } else { "replace-with-google-client-secret" }

$output = @(
  "DEBUG=false"
  "SECRET_KEY=$secretKey"
  "MAILMIND_HOST_PORT=$port"
  "ALLOWED_HOSTS=127.0.0.1,localhost"
  "CSRF_TRUSTED_ORIGINS=http://127.0.0.1:$port,http://localhost:$port"
  "CORS_ALLOWED_ORIGINS=http://127.0.0.1:$port,http://localhost:$port"
  ""
  "DB_NAME=mailmind_db"
  "DB_USER=mailmind_user"
  "DB_PASSWORD=mailmind_local_password"
  "DB_HOST=db"
  "DB_PORT=5432"
  ""
  "GOOGLE_CLIENT_ID=$googleClientId"
  "GOOGLE_CLIENT_SECRET=$googleClientSecret"
  "GOOGLE_REDIRECT_URI=http://127.0.0.1:$port/api/gmail/callback/"
  "FRONTEND_URL=http://127.0.0.1:$port"
)

Set-Content -Path $envPath -Value $output

Write-Host "Created backend/.env.localhost"
if ($googleClientId -like "replace-*" -or $googleClientSecret -like "replace-*") {
  Write-Warning "Google OAuth values are placeholders. MailMind account login works, but Gmail connect/login-with-Google will need real Google credentials added to backend/.env.localhost."
}
