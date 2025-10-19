import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';

const TARGET_URL = __ENV.TARGET_URL ?? 'http://localhost:3000/health';

export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 200,
      maxVUs: 400,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<120'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function load() {
  const response = http.get(TARGET_URL);
  check(response, {
    'status is 2xx/3xx': (res) => res.status >= 200 && res.status < 400,
  });
}

export function handleSummary(data) {
  const summaryText = textSummary(data, { indent: ' ', enableColors: false });
  const sloNotes = {
    thresholds: options.thresholds,
    target: TARGET_URL,
    runTimestamp: new Date().toISOString(),
    sloAssessment: data.metrics.http_req_failed && data.metrics.http_req_failed.values.rate < 0.01 &&
      data.metrics.http_req_duration && data.metrics.http_req_duration.values['p(95)'] < 120
      ? 'SLO satisfied'
      : 'SLO violated - investigate variance',
  };

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'artifacts/k6-load-summary.json': JSON.stringify(data, null, 2),
    'artifacts/k6-load-slo.json': JSON.stringify(sloNotes, null, 2),
    'artifacts/k6-load-summary.txt': `${summaryText}\nSLO assessment: ${sloNotes.sloAssessment}\n`,
  };
}
