import process from 'node:process';

const port = process.env.PORT ?? '3000';
const path = process.env.HEALTHCHECK_PATH ?? '/health';
const url = `http://127.0.0.1:${port}${path.startsWith('/') ? path : `/${path}`}`;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 4000);

fetch(url, { signal: controller.signal })
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }
    return response.json();
  })
  .then(() => {
    clearTimeout(timeout);
    process.exit(0);
  })
  .catch((error) => {
    console.error('healthcheck failure', error);
    clearTimeout(timeout);
    process.exit(1);
  });
