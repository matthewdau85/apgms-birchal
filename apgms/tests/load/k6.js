import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    allocations: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<250"],
    http_req_failed: ["rate<0.01"],
  },
};

const payload = {
  policies: [
    {
      id: "impact",
      weight: 2,
      cap: 1200,
      floor: 400,
      gate: { type: "maxAverageRisk", threshold: 0.4 },
    },
    {
      id: "operational",
      weight: 1,
      cap: 900,
      gate: { type: "maxSingleRisk", threshold: 0.6 },
    },
  ],
  contributions: [
    { amount: 420, riskScore: 0.18 },
    { amount: 380, riskScore: 0.22 },
    { amount: 310, riskScore: 0.27 },
  ],
};

export default function applyAllocations() {
  const url = `${__ENV.TARGET_URL ?? "http://localhost:3000"}/allocations/apply`;
  const response = http.post(url, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    timeout: "240s",
  });

  check(response, {
    "status 2xx": (res) => res.status === 200 || res.status === 201,
    "has response body": (res) => Boolean(res.body && res.body.length > 0),
  });

  sleep(0.01);
}
