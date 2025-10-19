# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm fetch

FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm -r build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/api-gateway/dist ./dist
COPY package.json pnpm-lock.yaml ./
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs
EXPOSE 3000
CMD ["node","dist/index.js"]
