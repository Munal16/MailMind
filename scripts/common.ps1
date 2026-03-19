$ErrorActionPreference = "Stop"

function Get-ListeningPids {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  $pids = @()

  foreach ($line in (netstat -ano -p TCP)) {
    if ($line -match $pattern) {
      $pids += [int]$matches[1]
    }
  }

  return $pids | Select-Object -Unique
}

function Stop-PortProcess {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [string]$Label = "service"
  )

  $pids = Get-ListeningPids -Port $Port
  if (-not $pids -or $pids.Count -eq 0) {
    return
  }

  foreach ($processId in $pids) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Stopped $Label process on port $Port (PID $processId)."
    } catch {
      Write-Warning "Could not stop PID $processId on port $Port. Close it manually if needed."
    }
  }

  Start-Sleep -Seconds 1
}

function Wait-ForHttp {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}
