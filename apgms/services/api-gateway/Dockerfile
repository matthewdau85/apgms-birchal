# ---- Build stage ----
FROM node:20-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml ./
COPY package.json ./
COPY packages ./packages
COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY services/api-gateway/tsconfig.json ./services/api-gateway/tsconfig.json
COPY services/api-gateway ./services/api-gateway

RUN pnpm install --frozen-lockfile
RUN pnpm -r build
RUN pnpm -r prune --prod

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "services/api-gateway/dist/index.js"]
