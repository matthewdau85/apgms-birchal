Param(
    [string]$ApiBaseUrl = "http://localhost:3000",
    [string]$Scenario = "smoke",
    [int]$Vus = 5,
    [string]$Duration = "1m"
)

$env:API_BASE_URL = $ApiBaseUrl
$env:VUS = $Vus
$env:DURATION = $Duration

Write-Host "Running k6 scenario '$Scenario' against $ApiBaseUrl with $Vus VUs for $Duration"

pnpm exec k6 run --tag scenario=$Scenario scripts/k6/load.js
