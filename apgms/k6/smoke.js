import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500']
  }
};

export default function () {
  const endpoints = ['/health','/ready','/metrics'];
  endpoints.forEach((p) => {
    const res = http.get(`${__ENV.BASE_URL || 'http://localhost:8080'}${p}`);
    check(res, {
      'status is 200 or 503 (ready may be 503)': (r) => [200,503].includes(r.status),
    });
  });
  sleep(1);
}
