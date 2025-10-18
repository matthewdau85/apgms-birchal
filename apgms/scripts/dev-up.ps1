param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  Write-Host "[dev-up] Starting Docker Compose services..."
  docker compose up -d | Out-Null

  Write-Host "[dev-up] Applying Prisma migrations..."
  pnpm --filter @apgms/shared db:migrate

  Write-Host "[dev-up] Generating Prisma client..."
  pnpm --filter @apgms/shared prisma:generate

  Write-Host "[dev-up] Seeding database with demo data..."
  pnpm exec tsx scripts/seed.ts

  Write-Host "[dev-up] Launching Fastify API..."
  $apiProcess = Start-Process pnpm -ArgumentList "--filter", "@apgms/api-gateway", "dev" -WorkingDirectory $repoRoot -PassThru

  Write-Host "[dev-up] Launching web application..."
  $webProcess = Start-Process pnpm -ArgumentList "--filter", "@apgms/webapp", "dev" -WorkingDirectory $repoRoot -PassThru

  if (-not $NoBrowser) {
    $url = "http://localhost:5173"
    Write-Host "[dev-up] Opening browser at $url"
    try {
      Start-Process $url | Out-Null
    } catch {
      Write-Warning "[dev-up] Failed to open browser automatically: $_"
    }
  }

  Write-Host "[dev-up] Development environment is ready. Press Ctrl+C to stop."
  Wait-Process -InputObject @($apiProcess, $webProcess)
} finally {
  foreach ($proc in @($apiProcess, $webProcess)) {
    if ($proc -and -not $proc.HasExited) {
      try {
        Stop-Process -Id $proc.Id -Force
      } catch {
      }
    }
  }
  Pop-Location
}
