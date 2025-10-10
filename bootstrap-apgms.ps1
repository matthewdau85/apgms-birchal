<# bootstrap-apgms-v2-win-fixed.ps1
PowerShell 5.1-safe: creates APGMS tree + lightweight file contents.
#>

param([string]$RepoName = "apgms")

function New-File { param([string]$Path,[string]$Content = "")
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
  Write-Host ("[WROTE] " + $Path)
}
function Touch([string]$p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
  New-File (Join-Path $p ".gitkeep") ""
}

# repo root
$root = Join-Path (Get-Location) $RepoName
New-Item -ItemType Directory -Path $root -Force | Out-Null
Set-Location $root

# root files (keep contents very simple to avoid quoting issues)
New-File ".editorconfig" "root = true`r`n`r`n[*]`r`nend_of_line = lf`r`ninsert_final_newline = true`r`ncharset = utf-8`r`nindent_style = space`r`nindent_size = 2"
New-File ".gitattributes" "* text=auto eol=lf"
New-File ".gitignore" "node_modules/`r`ndist/`r`ncoverage/`r`n.env*`r`n.DS_Store`r`n.vscode/`r`n**/__pycache__/"
New-File "LICENSE" "MIT License (placeholder)"
New-File "SECURITY.md" "# Security Policy`r`nEmail: security@yourdomain.example"
New-File "CODEOWNERS" "* @your-org/owners"
New-File "README.md" "# APGMS`r`n`r`nQuickstart:`r`npnpm i`r`npnpm -r build`r`ndocker compose up -d`r`npnpm -r test`r`npnpm -w exec playwright test"
New-File "CONTRIBUTING.md" "# Contributing"
New-File "pnpm-workspace.yaml" "packages:`r`n  - 'services/*'`r`n  - 'webapp'`r`n  - 'shared'`r`n  - 'worker'"
New-File "package.json" "{`"name`":`"apgms`",`"private`":true,`"version`":`"0.1.0`",`"workspaces`":[`"services/*`",`"webapp`",`"shared`",`"worker`"],`"scripts`":{`"build`":`"pnpm -r run build`",`"test`":`"pnpm -r run test`"}}"
New-File "docker-compose.yml" "version: '3.9'`r`nservices:`r`n  postgres:`r`n    image: postgres:15`r`n    environment:`r`n      POSTGRES_USER: apgms`r`n      POSTGRES_PASSWORD: apgms`r`n      POSTGRES_DB: apgms`r`n    ports: ['5432:5432']`r`n  redis:`r`n    image: redis:7`r`n    ports: ['6379:6379']"

# workflows
Touch ".github/workflows"
New-File ".github/workflows/ci.yml" "name: CI`r`non: [push, pull_request]`r`njobs:`r`n  build:`r`n    runs-on: ubuntu-latest`r`n    steps:`r`n      - uses: actions/checkout@v4`r`n      - uses: pnpm/action-setup@v4`r`n        with:`r`n          version: 9`r`n      - uses: actions/setup-node@v4`r`n        with:`r`n          node-version: '18'`r`n          cache: 'pnpm'`r`n      - run: pnpm i`r`n      - run: pnpm -r build`r`n      - run: pnpm -r test"
New-File ".github/workflows/e2e.yml" "name: E2E`r`non: [workflow_dispatch]`r`njobs:`r`n  e2e:`r`n    runs-on: ubuntu-latest`r`n    steps:`r`n      - uses: actions/checkout@v4`r`n      - uses: pnpm/action-setup@v4`r`n        with:`r`n          version: 9`r`n      - uses: actions/setup-node@v4`r`n        with:`r`n          node-version: '18'`r`n          cache: 'pnpm'`r`n      - run: pnpm i`r`n      - run: docker compose up -d`r`n      - run: pnpm -w exec playwright test"
New-File ".github/workflows/security.yml" "name: Security`r`non: [push]`r`njobs:`r`n  scan:`r`n    runs-on: ubuntu-latest`r`n    steps:`r`n      - uses: actions/checkout@v4`r`n      - run: echo scanning"

# scripts
Touch "scripts"
"dev-up","db-reset","seed","e2e-run","k6-load","key-rotate","export-dump" | ForEach-Object {
  New-File ("scripts/{0}.ps1" -f $_) "# $_ script"
}

# infra
Touch "infra/dev";              New-File "infra/dev/.env.example" "POSTGRES_USER=apgms`r`nPOSTGRES_PASSWORD=apgms`r`nPOSTGRES_DB=apgms`r`nJWT_SECRET=devsecret"
Touch "infra/iac";              New-File "infra/iac/main.tf" "# terraform root"; New-File "infra/iac/variables.tf" ""; New-File "infra/iac/outputs.tf" ""
Touch "infra/iac/modules/network"; Touch "infra/iac/modules/database"; Touch "infra/iac/modules/app"
Touch "infra/observability/grafana"; New-File "infra/observability/grafana/dashboards.json" "{}"

# docs
$docSets = "architecture","security","dsp-osf","ops","accessibility","ip","legal","partners","launch","risk","privacy","success"
$docSets | ForEach-Object { Touch ("docs/{0}" -f $_) }
New-File "docs/architecture/README.md" "# C4 + Sequences"
New-File "docs/security/ASVS-mapping.md" "# OWASP ASVS L2"
New-File "docs/security/TFN-SOP.md" "# TFN handling SOP"
New-File "docs/ops/runbook.md" "# Ops runbook"
New-File "docs/dsp-osf/evidence-index.md" "# DSP OSF evidence index"
New-File "docs/ip/guardrails.md" "# IP guardrails"
New-File "docs/legal/ToS-draft.md" "# Terms of Service draft"
New-File "docs/legal/Privacy-Policy-draft.md" "# Privacy Policy draft"
New-File "docs/partners/bank-packet.md" "# Bank partner packet"
New-File "docs/launch/pricing-page-draft.md" "# Pricing copy"
New-File "docs/risk/register.md" "# Risk register"
New-File "docs/accessibility/report.md" "# WCAG audit report"
New-File "docs/privacy/dpia.md" "# DPIA"
New-File "docs/success/playbooks.md" "# Customer Success playbooks"

# status
Touch "status"; New-File "status/README.md" "# Status site"

# tests & tools
Touch "tests/contract"; Touch "tests/e2e"; New-File "playwright.config.ts" "export default {};"
Touch "k6"; New-File "k6/bas-compile.js" "// k6"; New-File "k6/debit-path.js" "// k6"

# shared
Touch "shared/src"; Touch "shared/test"
New-File "shared/package.json" "{`"name`":`"@apgms/shared`",`"version`":`"0.1.0`",`"type`":`"module`",`"main`":`"dist/index.js`",`"scripts`":{`"build`":`"echo building shared`",`"test`":`"echo tests for shared`"}}"
New-File "shared/src/index.ts" "// shared"
New-File "shared/test/index.test.ts" "// tests"

# services (TS) — SAFE JSON via here-string, no -f in content
$svcTs = "api-gateway","payments","recon","audit","registries","sbr","connectors","cdr"
foreach ($s in $svcTs) {
  Touch ("services/{0}/src" -f $s)
  Touch ("services/{0}/test" -f $s)

  $pkgJson = @"
{
  "name": "@apgms/$s",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "echo build $s",
    "test": "echo test $s"
  }
}
"@
  New-File -Path ("services/{0}/package.json" -f $s) -Content $pkgJson
  New-File ("services/{0}/src/index.ts" -f $s) ("console.log('{0} service');" -f $s)
}

# tax engine (Python)
Touch "services/tax-engine/app"; Touch "services/tax-engine/tests"
New-File "services/tax-engine/pyproject.toml" "[tool.poetry]`r`nname='apgms-tax-engine'`r`nversion='0.1.0'`r`n[tool.poetry.dependencies]`r`npython='^3.10'`r`nfastapi='*'`r`nuvicorn='*'"
New-File "services/tax-engine/app/main.py" "from fastapi import FastAPI`r`napp = FastAPI()`r`n@app.get('/health')`r`ndef health():`r`n    return {'ok': True}"
New-File "services/tax-engine/app/__init__.py" ""

# webapp
Touch "webapp/src/components"; Touch "webapp/src/pages"; Touch "webapp/public"
New-File "webapp/package.json" "{`"name`":`"@apgms/webapp`",`"version`":`"0.1.0`",`"private`":true,`"scripts`":{`"build`":`"echo build webapp`",`"test`":`"echo test webapp`"}}"
New-File "webapp/src/main.tsx" "console.log('webapp');"
New-File "webapp/index.html" "<!doctype html><html><head><meta charset='utf-8'><title>APGMS</title></head><body><div id='root'></div></body></html>"

# worker
Touch "worker/src"; Touch "worker/test"
New-File "worker/package.json" "{`"name`":`"@apgms/worker`",`"version`":`"0.1.0`",`"type`":`"module`",`"main`":`"dist/index.js`",`"scripts`":{`"build`":`"echo build worker`",`"test`":`"echo test worker`"}}"
New-File "worker/src/index.ts" "console.log('worker');"

Write-Host "Done. Next:" -ForegroundColor Green
Write-Host "1) git init; git add .; git commit -m 'bootstrap skeleton'"
Write-Host "2) pnpm i"
Write-Host "3) Start filling with your Codex prompts"
