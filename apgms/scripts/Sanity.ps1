[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Write-Heading {
    param(
        [Parameter(Mandatory = $true)][string]$Message
    )
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][ScriptBlock]$Action
    )

    Write-Heading $Description
    try {
        & $Action
        $exitCode = $LASTEXITCODE
        if ($null -ne $exitCode -and $exitCode -ne 0) {
            throw "Command exited with code $exitCode"
        }
        Write-Host "✓ $Description" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ $Description" -ForegroundColor Red
        throw
    }
}

function Ensure-Dependency {
    param(
        [Parameter(Mandatory = $true)][string]$Command
    )

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Required command '$Command' was not found in PATH."
    }
}

function Ensure-Postgres {
    param(
        [Parameter(Mandatory = $true)][string]$ComposeFile,
        [int]$Port = 5432
    )

    Ensure-Dependency -Command 'docker'

    $postgresRunning = $false
    try {
        $runningServices = & docker compose -f $ComposeFile ps --services --filter "status=running" 2>$null
        if ($LASTEXITCODE -eq 0 -and $runningServices) {
            $postgresRunning = ($runningServices -split "`n" | Where-Object { $_ -eq 'postgres' }) -ne $null
        }
    }
    catch {
        Write-Host 'Unable to determine docker compose service status; will attempt to start postgres.' -ForegroundColor Yellow
    }

    if (-not $postgresRunning) {
        Write-Host 'Starting postgres container via docker compose…'
        & docker compose -f $ComposeFile up -d postgres
        if ($LASTEXITCODE -ne 0) {
            throw 'Failed to start postgres via docker compose.'
        }
    }
    else {
        Write-Host 'Postgres container already running.' -ForegroundColor Green
    }

    if (-not (Test-PortOpen -Host '127.0.0.1' -Port $Port -TimeoutSeconds 30)) {
        throw "Postgres did not become ready on port $Port within the expected time."
    }
}

function Test-PortOpen {
    param(
        [Parameter(Mandatory = $true)][string]$Host,
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutSeconds = 15
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $asyncResult = $client.BeginConnect($Host, $Port, $null, $null)
            if ($asyncResult.AsyncWaitHandle.WaitOne(1000)) {
                $client.EndConnect($asyncResult)
                $client.Dispose()
                return $true
            }
            $client.Dispose()
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

function Invoke-Probes {
    param(
        [Parameter(Mandatory = $true)][uri]$BaseUri,
        [string[]]$Paths = @('/health', '/users', '/bank-lines')
    )

    foreach ($path in $Paths) {
        $uri = [uri]::new($BaseUri, $path)
        try {
            $response = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 10
            Write-Host "GET $uri" -ForegroundColor DarkGray
            Write-Host ($response | ConvertTo-Json -Depth 5)
        }
        catch {
            throw "Request to $uri failed: $($_.Exception.Message)"
        }
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

try {
    $sharedDist = Join-Path $repoRoot 'shared/dist'
    if (-not (Test-Path $sharedDist)) {
        throw "Expected directory '$sharedDist' to exist. Run 'pnpm --filter @apgms/shared build' first."
    }
    Write-Host "Verified shared/dist exists at $sharedDist" -ForegroundColor Green

    $envFile = Join-Path $repoRoot '.env'
    if (Test-Path $envFile) {
        Write-Host 'Loading environment variables from .env'
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^[#\s]' -or -not $_) { return }
            $parts = $_ -split '=', 2
            if ($parts.Length -eq 2) {
                $name = $parts[0].Trim()
                $value = $parts[1].Trim().Trim('"')
                [System.Environment]::SetEnvironmentVariable($name, $value)
            }
        }
    }

    if (-not $env:DATABASE_URL) {
        $env:DATABASE_URL = 'postgresql://apgms:apgms@localhost:5432/apgms'
        Write-Host "DATABASE_URL not set. Defaulting to $($env:DATABASE_URL)" -ForegroundColor Yellow
    }
    if (-not $env:SHADOW_DATABASE_URL) {
        $env:SHADOW_DATABASE_URL = 'postgresql://apgms:apgms@localhost:5432/apgms_shadow'
        Write-Host "SHADOW_DATABASE_URL not set. Defaulting to $($env:SHADOW_DATABASE_URL)" -ForegroundColor Yellow
    }

    Invoke-Step -Description 'Ensuring postgres is available' -Action {
        Ensure-Postgres -ComposeFile (Join-Path $repoRoot 'docker-compose.yml')
    }

    Ensure-Dependency -Command 'pnpm'
    Ensure-Dependency -Command 'node'

    Invoke-Step -Description 'Running database migrations' -Action {
        & pnpm exec prisma migrate deploy --schema shared/prisma/schema.prisma
    }

    Invoke-Step -Description 'Seeding database' -Action {
        & pnpm exec tsx scripts/seed.ts
    }

    $gatewayDist = Join-Path $repoRoot 'services/api-gateway/dist'
    if (Test-Path $gatewayDist) {
        Remove-Item $gatewayDist -Recurse -Force
    }

    Invoke-Step -Description 'Building API Gateway' -Action {
        & pnpm exec tsc --project services/api-gateway/tsconfig.json --outDir $gatewayDist --rootDir services/api-gateway/src
    }

    $gatewayEntry = Join-Path $gatewayDist 'src/index.js'
    if (-not (Test-Path $gatewayEntry)) {
        throw "Gateway build did not produce expected entry file at $gatewayEntry"
    }

    Write-Heading 'Starting API Gateway for smoke tests'
    $gatewayProcess = Start-Process -FilePath 'node' -ArgumentList $gatewayEntry -WorkingDirectory $repoRoot -PassThru -NoNewWindow

    try {
        if (-not (Test-PortOpen -Host '127.0.0.1' -Port 3000 -TimeoutSeconds 30)) {
            throw 'Gateway did not start on port 3000 in time.'
        }

        Invoke-Step -Description 'Probing API Gateway endpoints' -Action {
            Invoke-Probes -BaseUri ([uri]'http://127.0.0.1:3000')
        }
    }
    finally {
        if ($gatewayProcess -and -not $gatewayProcess.HasExited) {
            Write-Host 'Stopping API Gateway process'
            $gatewayProcess.Kill()
            $gatewayProcess.WaitForExit()
        }
    }

    Write-Heading 'Next steps'
    Write-Host "- Run 'pnpm --filter @apgms/api-gateway dev' to start the gateway in watch mode."
    Write-Host "- Visit http://localhost:3000/bank-lines in your browser to confirm data."
    Write-Host "- Use 'pnpm -r test' to run the workspace test suite."

    Write-Host "`nSanity checks completed successfully." -ForegroundColor Green
}
finally {
    Set-Location -Path $PSScriptRoot
}
