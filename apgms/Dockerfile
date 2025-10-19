FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable \
    && pnpm install --frozen-lockfile \
    && pnpm run build \
    && pnpm prune --prod

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=build /app .
USER 65532:65532
EXPOSE 3000
ENV NODE_ENV=production
HEALTHCHECK CMD ["/nodejs/bin/node","-e","fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["services/api-gateway/dist/index.js"]
