# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY shared/package.json shared/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
RUN pnpm install --filter @apgms/api-gateway... --frozen-lockfile

COPY . .
RUN pnpm --filter @apgms/api-gateway... run build
RUN pnpm --filter @apgms/api-gateway deploy --prod --legacy /app/out

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/out/ ./
USER nonroot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:3000/readyz',{cache:'no-store'}).then(r=>{if(!r.ok)process.exit(1);}).catch(()=>process.exit(1));"]
CMD ["dist/index.js"]
