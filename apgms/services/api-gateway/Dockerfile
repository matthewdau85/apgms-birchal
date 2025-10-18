# syntax=docker/dockerfile:1

FROM node:20 AS deps
WORKDIR /workspace
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY shared/package.json shared/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 pnpm --filter @apgms/shared prisma:generate
RUN pnpm exec tsc --project tsconfig.build.json
RUN pnpm prune --prod

FROM gcr.io/distroless/nodejs20
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV TMPDIR=/tmp

COPY --from=build /workspace/dist /app/dist
COPY --from=build /workspace/node_modules /app/node_modules
COPY --from=build /workspace/package.json /app/package.json
COPY --from=build /workspace/pnpm-workspace.yaml /app/pnpm-workspace.yaml

USER 10001:10001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD [
  "node",
  "-e",
  "fetch('http://127.0.0.1:' + (process.env.PORT ?? '3000') + '/healthz').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1));"
]

ENTRYPOINT ["node", "dist/services/api-gateway/src/index.js"]
