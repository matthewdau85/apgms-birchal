import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500'] }
};

export default function () {
  const base = __ENV.BASE_URL || 'http://localhost:8080';
  ['/health','/ready','/metrics'].forEach((p) => {
    const res = http.get(`${base}${p}`);
    check(res, { 'ok': (r) => [200,503].includes(r.status) });
  });
  sleep(1);
}
