# ---- Build stage ----
FROM node:20-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Copy only lockfile and package manifests for better caching
COPY pnpm-lock.yaml ./
COPY package.json ./
# Copy workspace manifests (monorepo)
COPY packages ./packages
COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY services/api-gateway/tsconfig.json ./services/api-gateway/tsconfig.json
# Copy source
COPY services/api-gateway ./services/api-gateway

RUN pnpm install --frozen-lockfile
RUN pnpm -r build

# Prune dev deps (keep prod for runtime only in gateway)
RUN pnpm -r prune --prod

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copy built files and prod node_modules for gateway
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "services/api-gateway/dist/index.js"]
