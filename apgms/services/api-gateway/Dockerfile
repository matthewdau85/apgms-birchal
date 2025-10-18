# syntax=docker/dockerfile:1

FROM node:20-bullseye AS build
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY services/api-gateway/package.json services/api-gateway/
COPY shared/package.json shared/
COPY worker/package.json worker/
COPY webapp/package.json webapp/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec tsc -p tsconfig.json
RUN pnpm prune --prod

FROM busybox:1.36 AS busybox

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=busybox /bin/busybox /bin/busybox
COPY --from=busybox /bin/busybox /bin/sh
COPY --from=busybox /bin/busybox /bin/wget

COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json

USER 10001
EXPOSE 3000
VOLUME ["/tmp"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/bin/sh","-c","wget -qO- http://127.0.0.1:3000/healthz || exit 1"]

ENTRYPOINT ["node","dist/services/api-gateway/src/index.js"]
