# syntax=docker/dockerfile:1.5

FROM node:20-bookworm-slim AS builder
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apgms/package.json apgms/package.json
COPY apgms/shared/package.json apgms/shared/package.json
COPY apgms/services/api-gateway/package.json apgms/services/api-gateway/package.json
RUN pnpm install --frozen-lockfile
COPY apgms ./apgms
RUN pnpm --dir apgms/shared run build
RUN pnpm --dir apgms/services/api-gateway run build
RUN pnpm prune --prod

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /srv/app
ENV NODE_ENV=production
ENV NODE_PATH=/srv/app/node_modules
COPY --from=builder /workspace/apgms/services/api-gateway/dist ./dist
COPY --from=builder /workspace/apgms/services/api-gateway/package.json ./package.json
COPY --from=builder /workspace/apgms/services/api-gateway/healthcheck.mjs ./healthcheck.mjs
COPY --from=builder /workspace/apgms/shared/dist ./shared/dist
COPY --from=builder /workspace/apgms/shared/package.json ./shared/package.json
COPY --from=builder /workspace/apgms/node_modules ./node_modules
USER nonroot
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node", "/srv/app/healthcheck.mjs"]
CMD ["node", "dist/index.js"]
