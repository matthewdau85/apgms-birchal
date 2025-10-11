# PowerShell helpers for writing UTF-8 files without a BOM
function Write-Utf8NoBom {
  param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][string]$Content)
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $Path), $Content, $utf8NoBom)
}
function Set-JsonNoBom {
  param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][hashtable]$Obj,[int]$Depth=50)
  $json = $Obj | ConvertTo-Json -Depth $Depth
  Write-Utf8NoBom -Path $Path -Content $json
}
function Remove-Bom {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path $Path)) { return }
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    [System.IO.File]::WriteAllBytes((Resolve-Path $Path), $bytes[3..($bytes.Length-1)])
    Write-Host "Removed BOM from $Path"
  }
}
