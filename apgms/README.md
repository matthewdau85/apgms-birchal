# APGMS Monorepo

A lightweight pnpm workspace that powers the API gateway, background worker and Tailwind + React web application for the APGMS demo environment.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop or Docker Engine

## Getting started

```sh
cd apgms
pnpm install
cp .env.example .env # optional when you want to customise credentials
pnpm prisma:generate
```

## Run the infrastructure

```sh
docker compose up -d
```

Postgres will be available on `localhost:5433` and automatically seeded when the API or worker starts for the first time.

## Develop the services

### API Gateway

```sh
pnpm dev:api
```

The Fastify server listens on <http://localhost:3000>. Health and REST endpoints are defined in `services/api-gateway/src`.

### Web application

```sh
pnpm dev:web
```

The Vite development server listens on <http://localhost:5173>. It consumes the API gateway and provides a small dashboard for bank lines. TailwindCSS is configured via `postcss.config.js`.

### Worker

```sh
pnpm dev:worker
```

The worker polls for newly created bank lines and logs them to the console. Use `WORKER_INTERVAL_MS` in `.env` to control the polling cadence.

## Build all packages

```sh
pnpm build
```

Each package is responsible for compiling its own TypeScript output.
