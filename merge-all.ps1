param(
  [string]$IntegrationBranch = "integration/mega-merge",
  [string]$Include = "^(?!main$).+",
  [switch]$DraftPR
)

$ErrorActionPreference = "Stop"

function Run($cmd, $args) {
  & $cmd @args
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $cmd $($args -join ' ')" }
}

Write-Host "== Fetching remotes ==" -ForegroundColor Cyan
Run git @("fetch","--all","--prune")

Write-Host "== Checkout and fast-forward main ==" -ForegroundColor Cyan
Run git @("checkout","main")
Run git @("pull","--ff-only","origin","main")

Write-Host "== Create/refresh integration branch: $IntegrationBranch ==" -ForegroundColor Cyan
# Create from main if it doesn't exist locally
try {
  Run git @("checkout","-B",$IntegrationBranch)
} catch {
  throw "Could not create/switch to $IntegrationBranch. Resolve your working tree state and re-run."
}
Run git @("push","-u","origin",$IntegrationBranch) | Out-Null

Write-Host "== Discovering remote branches ==" -ForegroundColor Cyan
$remoteBranches = git branch -r --format="%(refname:short)" `
  | ForEach-Object { $_.Trim() } `
  | Where-Object { $_ -notmatch "/HEAD$" -and $_ -notmatch "/main$" } `
  | ForEach-Object { $_ -replace "^origin/", "" } `
  | Sort-Object -Unique `
  | Where-Object { $_ -match $Include }

if (-not $remoteBranches) {
  Write-Host "No remote branches matched Include='$Include'." -ForegroundColor Yellow
  exit 0
}

Write-Host "Merging these branches:" -ForegroundColor Cyan
$remoteBranches | ForEach-Object { Write-Host "  - $_" }

foreach ($b in $remoteBranches) {
  Write-Host "=== Merging $b ===" -ForegroundColor Cyan
  # Ensure we have the latest ref for the branch
  git fetch origin "$b:refs/remotes/origin/$b" | Out-Null

  # Preview merge to surface conflicts but avoid committing
  $mergeHadIssues = $false
  try {
    git merge --no-commit --no-ff "origin/$b" | Out-Null
  } catch {
    $mergeHadIssues = $true
    Write-Warning "Merge reported issues; checking for conflicts."
  }

  # Check for unmerged files
  $conflicts = git diff --name-only --diff-filter=U
  if (-not [string]::IsNullOrWhiteSpace($conflicts)) {
    Write-Host "Conflicts detected merging ${b}:" -ForegroundColor Yellow
    $conflicts | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "Resolve conflicts, then run:" -ForegroundColor Yellow
    Write-Host "  git add -A"
    Write-Host "  git commit -m 'Resolve conflicts merging $b'"
    Write-Host "Re-run this script to continue with the next branch." -ForegroundColor Yellow
    exit 1
  }

  # If nothing to merge, Git prints "Already up to date." and there is no pending merge
  $mergeState = git rev-parse -q --verify MERGE_HEAD 2>$null
  if ($mergeState) {
    git commit -m "Merge branch '$b' into $IntegrationBranch" | Out-Null
    # Optional quick gates — comment out if slow in your env:
    try { pnpm -r build | Out-Null } catch { throw "Build failed after $b" }
    try { pnpm -r test  | Out-Null } catch { throw "Tests failed after $b" }
    git push | Out-Null
  } else {
    Write-Host "Already up to date: $b"
  }
}

if ($DraftPR) {
  Write-Host "== Creating draft PR (if none exists) ==" -ForegroundColor Cyan
  try {
    gh pr view $IntegrationBranch --json number 2>$null | Out-Null
    Write-Host "PR already exists for $IntegrationBranch."
  } catch {
    gh pr create -B main -H $IntegrationBranch `
      --title "Batch merge: $IntegrationBranch → main" `
      --body "Large integration PR; batched auto-merges. Review by path filters." `
      --draft
  }
}

Write-Host "Done. All selected branches processed." -ForegroundColor Green