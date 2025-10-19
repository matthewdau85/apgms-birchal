import http from 'k6/http';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';

const TARGET_URL = __ENV.TARGET_URL ?? 'http://localhost:3000/health';

export const options = {
  vus: 1,
  iterations: 10,
};

export default function smoke() {
  const response = http.get(TARGET_URL);
  check(response, {
    'status is 2xx/3xx': (res) => res.status >= 200 && res.status < 400,
  });
  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'artifacts/k6-smoke-summary.json': JSON.stringify(data, null, 2),
    'artifacts/k6-smoke-summary.txt': textSummary(data, { indent: ' ', enableColors: false }),
  };
}
