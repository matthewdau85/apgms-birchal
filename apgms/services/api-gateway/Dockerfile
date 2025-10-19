# syntax=docker/dockerfile:1.6
FROM node:20-slim AS build
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/package.json
COPY shared/prisma/schema.prisma shared/prisma/schema.prisma
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/payments/package.json services/payments/package.json
COPY services/sbr/package.json services/sbr/package.json
COPY worker/package.json worker/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @apgms/api-gateway build

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /workspace/services/api-gateway/dist ./dist
COPY --from=build /workspace/services/api-gateway/package.json ./package.json
COPY --from=build /workspace/node_modules ./node_modules

USER nonroot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["dist/index.js"]
