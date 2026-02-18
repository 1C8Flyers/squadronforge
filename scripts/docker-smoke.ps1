param(
  [string]$ApiUrl = "http://localhost:4000",
  [int]$MaxWaitSeconds = 90
)

$ErrorActionPreference = "Stop"

Push-Location (Split-Path -Parent $PSScriptRoot)

function Write-DockerDiagnostics {
  Write-Host "`n--- docker compose ps ---"
  docker compose ps

  Write-Host "`n--- api logs (tail 120) ---"
  docker compose logs api --tail 120

  Write-Host "`n--- db logs (tail 120) ---"
  docker compose logs db --tail 120

  Write-Host "`n--- worker logs (tail 120) ---"
  docker compose logs worker --tail 120
}

try {
  Write-Host "Building and starting containers..."
  docker compose up -d --build
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed with exit code $LASTEXITCODE"
  }

  Write-Host "Waiting for API health endpoint..."
  $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
  $healthy = $false

  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Method Get -Uri "$ApiUrl/health" -TimeoutSec 5
      if ($health.status -eq "ok") {
        $healthy = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  if (-not $healthy) {
    throw "API did not become healthy within $MaxWaitSeconds seconds."
  }

  Write-Host "Checking metrics endpoint..."
  $metrics = Invoke-RestMethod -Method Get -Uri "$ApiUrl/metrics" -TimeoutSec 5
  if (-not $metrics.tenantCount -and $metrics.tenantCount -ne 0) {
    throw "Metrics response missing tenantCount."
  }

  Write-Host "Smoke test passed."
} catch {
  Write-Host "Smoke test failed: $($_.Exception.Message)"
  Write-DockerDiagnostics
  throw
} finally {
  Pop-Location
}
