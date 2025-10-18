# syntax=docker/dockerfile:1.6

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable
WORKDIR /workspace

FROM base AS install
COPY apgms/pnpm-workspace.yaml ./
COPY apgms/pnpm-lock.yaml ./
COPY apgms/package.json ./
COPY apgms/services/api-gateway/package.json services/api-gateway/
COPY apgms/shared/package.json shared/
RUN pnpm install --frozen-lockfile

FROM install AS build
COPY apgms ./
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate --schema shared/prisma/schema.prisma

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /workspace/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /workspace/package.json ./package.json
COPY --from=build --chown=nonroot:nonroot /workspace/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build --chown=nonroot:nonroot /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build --chown=nonroot:nonroot /workspace/services/api-gateway ./services/api-gateway
COPY --from=build --chown=nonroot:nonroot /workspace/shared ./shared

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD ["node", "-e", "const http=require('http');const port=process.env.PORT||3000;const req=http.get('http://127.0.0.1:'+port+'/healthz', res=>{if(res.statusCode===200){process.exit(0);}process.exit(1);});req.on('error',()=>process.exit(1));setTimeout(()=>{req.destroy();process.exit(1);},4000);"]

USER nonroot
ENTRYPOINT ["node", "--loader", "tsx", "services/api-gateway/src/index.ts"]
