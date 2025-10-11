#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RootDir

$envFile = Join-Path $RootDir ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ([string]::IsNullOrWhiteSpace($_)) { return }
    $trimmed = $_.Trim()
    if ($trimmed.StartsWith("#")) { return }
    $index = $trimmed.IndexOf("=")
    if ($index -lt 0) { return }
    $name = $trimmed.Substring(0, $index).Trim()
    $value = $trimmed.Substring($index + 1).Trim()
    if ($value.Length -ge 2 -and (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path Env:$name -Value $value
  }
}

if ($args.Count -gt 0) {
  pnpm run dev-up -- $args
} else {
  pnpm run dev-up
}
