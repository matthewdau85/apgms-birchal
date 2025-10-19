import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<700', 'p(99)<1500'],
  }
};

export default function () {
  const base = __ENV.BASE_URL || 'http://localhost:8080';
  const r1 = http.get(`${base}/health`);
  const r2 = http.get(`${base}/ready`);
  check(r1, { 'health 200': (r) => r.status === 200 });
  check(r2, { 'ready 200/503': (r) => [200,503].includes(r.status) });
  sleep(0.3);
}
