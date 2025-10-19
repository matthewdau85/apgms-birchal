# syntax=docker/dockerfile:1

FROM node:20 AS builder
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY shared/package.json shared/package.json

RUN corepack enable \
  && pnpm install --filter @apgms/api-gateway... --frozen-lockfile

COPY services/api-gateway services/api-gateway
COPY shared shared

FROM gcr.io/distroless/nodejs20:nonroot
WORKDIR /app

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/services/api-gateway ./services/api-gateway
COPY --from=builder /workspace/shared ./shared

USER nonroot
WORKDIR /app/services/api-gateway

HEALTHCHECK CMD ["node","healthcheck.js"]

CMD ["--loader","tsx","./src/index.ts"]
