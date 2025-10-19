# syntax=docker/dockerfile:1.7

FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install dependencies for the API gateway and its workspace deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY services/api-gateway/package.json services/api-gateway/
COPY shared/package.json shared/
RUN pnpm install --filter @apgms/api-gateway... --frozen-lockfile --prod=false

# Copy the rest of the source required at runtime
COPY shared ./shared
COPY services/api-gateway ./services/api-gateway

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy application code and dependencies from the builder stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=base /app/shared ./shared
COPY --from=base /app/services/api-gateway ./services/api-gateway

EXPOSE 3000
CMD ["node", "--loader", "tsx", "services/api-gateway/src/index.ts"]
