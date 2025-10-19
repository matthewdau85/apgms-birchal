param(
    [string]$EnvPath = $(Join-Path (Split-Path -Path $PSScriptRoot -Parent) ".env")
)

function ConvertTo-Pem {
    param(
        [byte[]]$Bytes,
        [string]$Header,
        [string]$Footer
    )

    $base64 = [System.Convert]::ToBase64String($Bytes)
    $builder = New-Object System.Text.StringBuilder

    for ($offset = 0; $offset -lt $base64.Length; $offset += 64) {
        $lineLength = [System.Math]::Min(64, $base64.Length - $offset)
        [void]$builder.AppendLine($base64.Substring($offset, $lineLength))
    }

    return "$Header`n$($builder.ToString())$Footer`n"
}

function Set-EnvValue {
    param(
        [string]$Content,
        [string]$Key,
        [string]$Value
    )

    $escapedValue = $Value -replace "`r?`n", "\\n"
    $line = "$Key=\"$escapedValue\""

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return "$line`n"
    }

    if ([System.Text.RegularExpressions.Regex]::IsMatch($Content, "(?m)^$Key=.*$")) {
        return [System.Text.RegularExpressions.Regex]::Replace($Content, "(?m)^$Key=.*$", $line)
    }

    if (-not $Content.EndsWith("`n")) {
        $Content += "`n"
    }

    return "$Content$line`n"
}

$resolvedEnvPath = $EnvPath
if (-not (Test-Path -Path $resolvedEnvPath)) {
    $resolvedEnvPath = Join-Path (Get-Location) $EnvPath
}

$envDirectory = Split-Path -Path $resolvedEnvPath -Parent
if (-not (Test-Path -Path $envDirectory)) {
    New-Item -ItemType Directory -Path $envDirectory -Force | Out-Null
}

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$privateKeyPem = ConvertTo-Pem -Bytes $rsa.ExportPkcs8PrivateKey() -Header "-----BEGIN PRIVATE KEY-----" -Footer "-----END PRIVATE KEY-----"
$publicKeyPem = ConvertTo-Pem -Bytes $rsa.ExportSubjectPublicKeyInfo() -Header "-----BEGIN PUBLIC KEY-----" -Footer "-----END PUBLIC KEY-----"

$currentContent = ""
if (Test-Path -Path $resolvedEnvPath) {
    $currentContent = Get-Content -Path $resolvedEnvPath -Raw
}

$currentContent = Set-EnvValue -Content $currentContent -Key "JWT_PRIVATE_KEY" -Value $privateKeyPem
$currentContent = Set-EnvValue -Content $currentContent -Key "JWT_PUBLIC_KEY" -Value $publicKeyPem

Set-Content -Path $resolvedEnvPath -Value $currentContent -Encoding UTF8

Write-Host "✅ JWT signing keys rotated." -ForegroundColor Green
Write-Host "Updated $resolvedEnvPath with a new key pair." -ForegroundColor Green
Write-Host "Redeploy or restart any services that cache the previous key to begin using the new material." -ForegroundColor Yellow
