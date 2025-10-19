param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ForwardedArgs
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")

Push-Location $repoRoot
try {
  pnpm exec tsx scripts/key-rotate.ts @ForwardedArgs
}
finally {
  Pop-Location
}
