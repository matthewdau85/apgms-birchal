# APGMS

## Environment setup

1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Copy the example environment file and fill in secrets:
   ```sh
   cp .env.example .env
   ```
3. Generate a strong JWT signing secret when rotating credentials:
   ```sh
   pnpm tsx scripts/key-rotate.ts
   ```
   The script prints the new secret to `stdout`. Update `JWT_SECRET` in your `.env` file (or secret manager) with the generated value.
4. Load the environment variables into your shell before running services:
   ```sh
   set -a
   source .env
   set +a
   ```
   On Windows PowerShell, run:
   ```powershell
   Get-Content .env | foreach { if ($_.Trim() -and -not $_.StartsWith('#')) { $name, $value = $_.Split('='); Set-Item -Path Env:$name -Value $value.Trim('"') } }
   ```

## Running locally

Spin up the infrastructure and execute the workspace scripts:

```sh
docker compose up -d
pnpm -r build
pnpm -r test
pnpm -w exec playwright test
```

## Rotating JWT secrets

You can customise the key size and encoding when generating a new secret:

```sh
pnpm tsx scripts/key-rotate.ts --bytes 48 --format hex
```

The PowerShell wrapper forwards all arguments:

```powershell
./scripts/key-rotate.ps1 --bytes 48 --format hex
```

## Required CI/CD secrets

The GitHub workflows expect the following environment variables to be supplied as repository or environment secrets:

- `DATABASE_URL`
- `JWT_SECRET`
- `REDIS_URL`
- `ALLOWED_ORIGINS`

Workflows will fail fast if any of these values are missing.
