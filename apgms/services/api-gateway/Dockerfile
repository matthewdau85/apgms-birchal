FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY ../../pnpm-workspace.yaml ../../package.json ../../pnpm-lock.yaml ./
RUN pnpm fetch
COPY ../../ ./
RUN pnpm -w install --frozen-lockfile
RUN pnpm -r build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=deps /app .
EXPOSE 3000
CMD ["node","services/api-gateway/dist/index.js"]
