# APGMS

## Quickstart

### Prerequisites
- [pnpm](https://pnpm.io/installation)
- Node.js 18+

### Install dependencies
```bash
pnpm install
```

### Configure environment
Copy the sample environment file for the web application and update values as needed:
```bash
cp webapp/.env.example webapp/.env
```

### Run the web application
```bash
pnpm --filter @apgms/webapp dev
```

### Additional scripts
```bash
pnpm -r build
pnpm -r test
pnpm -w exec playwright test
```
