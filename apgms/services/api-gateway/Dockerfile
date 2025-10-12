# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services ./services
COPY shared ./shared
RUN pnpm install --filter @apgms/api-gateway... --filter @apgms/shared... --frozen-lockfile
RUN pnpm --filter @apgms/shared prisma:generate

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/api-gateway ./services/api-gateway
COPY --from=deps /app/shared ./shared
ARG GIT_SHA=local
RUN echo "${GIT_SHA}" > /version
EXPOSE 3000
CMD ["node", "--loader", "tsx", "services/api-gateway/src/index.ts"]
