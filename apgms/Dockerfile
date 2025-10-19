# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Copy the entire repository to preserve the pre-installed dependencies
COPY . .

# Materialize the healthcheck script inside the workspace so it can be
# copied into the distroless runtime image without needing an extra file
RUN cat <<'JS' > healthcheck.js
const http = require('node:http');

const port = Number(process.env.PORT ?? 3000);
const timeout = Number(process.env.HEALTHCHECK_TIMEOUT ?? 5000);
const host = process.env.HEALTHCHECK_HOST ?? '127.0.0.1';

const probe = (pathname) =>
  new Promise((resolve, reject) => {
    const request = http.request(
      {
        host,
        port,
        path: pathname,
        method: 'GET',
      },
      (res) => {
        clearTimeout(timer);
        res.resume();
        if (res.statusCode && res.statusCode < 400) {
          resolve();
        } else {
          reject(new Error(`unexpected status ${res.statusCode}`));
        }
      },
    );

    const timer = setTimeout(() => {
      request.destroy(new Error(`timeout after ${timeout}ms`));
    }, timeout);

    request.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    request.end();
  });

const run = async () => {
  try {
    await probe('/readyz');
    process.exit(0);
  } catch (primaryError) {
    try {
      await probe('/health');
      process.exit(0);
    } catch (fallbackError) {
      console.error('Readiness probes failed', { primaryError, fallbackError });
      process.exit(1);
    }
  }
};

run();
JS

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app

COPY --from=builder /app /app

ENV NODE_ENV=production
USER nonroot

HEALTHCHECK CMD ["node", "healthcheck.js"]
CMD ["node", "--no-warnings", "--loader", "tsx", "services/api-gateway/src/index.ts"]
