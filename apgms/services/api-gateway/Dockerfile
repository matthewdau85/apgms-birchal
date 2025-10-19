# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable \
    && apk add --no-cache libc6-compat openssl

FROM base AS deps
WORKDIR /workspace/apgms/services/api-gateway

# Copy service sources
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
COPY docker-shared /tmp/docker-shared

# Recreate the minimal monorepo structure expected by pnpm
RUN mkdir -p /workspace/apgms/shared \
    && cp -a /tmp/docker-shared/. /workspace/apgms/shared \
    && rm -rf /tmp/docker-shared

# Install dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Generate Prisma client and build TypeScript output
RUN pnpm exec prisma generate --schema ../../shared/prisma/schema.prisma
RUN pnpm exec tsc --project tsconfig.json --outDir dist

# Remove dev dependencies to slim runtime
RUN pnpm prune --prod

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace/apgms/services/api-gateway

# Copy shared workspace assets required at runtime
COPY --from=deps /workspace/apgms/shared /workspace/apgms/shared

# Copy compiled app and production dependencies
COPY --from=deps /workspace/apgms/services/api-gateway/dist ./dist
COPY --from=deps /workspace/apgms/services/api-gateway/node_modules ./node_modules
COPY --from=deps /workspace/apgms/services/api-gateway/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/index.js"]
