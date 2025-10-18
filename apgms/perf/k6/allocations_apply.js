import http from "k6/http";
import { Trend, Rate } from "k6/metrics";
import { check, group, sleep } from "k6";

export const options = {
  vus: Number(__ENV.VUS ?? 50),
  duration: __ENV.DURATION ?? "5m",
  thresholds: {
    http_req_duration: ["p(95)<250"],
    http_req_failed: ["rate<0.01"],
    allocation_latency: ["p(95)<250"],
    line_creation_latency: ["p(95)<250"],
  },
};

const BASE_URL = __ENV.BASE_URL ?? "http://localhost:3000";
const ORG_ID = __ENV.ORG_ID ?? "demo-org";
const IDEMPOTENCY_KEY = __ENV.IDEMPOTENCY_KEY ?? "dev-allocations-apply";
const ITERATION_SLEEP = Number(__ENV.ITERATION_SLEEP ?? "0.5");

const lineCreationLatency = new Trend("line_creation_latency", true);
const allocationLatency = new Trend("allocation_latency", true);
const lineErrorRate = new Rate("line_creation_errors");
const allocationErrorRate = new Rate("allocation_errors");

function randomAmount() {
  const sign = Math.random() > 0.5 ? 1 : -1;
  const magnitude = Math.round(Math.random() * 50000) / 100;
  return sign * (magnitude || 100);
}

function randomIsoDate() {
  const now = new Date();
  const deltaDays = Math.floor(Math.random() * 30);
  const sample = new Date(now.getFullYear(), now.getMonth(), now.getDate() - deltaDays);
  return sample.toISOString();
}

function randomPayee() {
  const payees = ["Birchal", "Acme Co", "Globex", "Soylent", "Initech", "Umbra"];
  return payees[Math.floor(Math.random() * payees.length)];
}

function randomDesc() {
  const descriptions = [
    "Monthly subscription",
    "Team offsite",
    "Supplier payment",
    "Refund processed",
    "Card top up",
    "Investment received",
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

export default function allocationsApplyScenario() {
  const headers = {
    "Content-Type": "application/json",
  };

  group("create bank line", () => {
    const payload = {
      orgId: ORG_ID,
      date: randomIsoDate(),
      amount: randomAmount(),
      payee: randomPayee(),
      desc: randomDesc(),
    };

    const res = http.post(`${BASE_URL}/bank-lines`, JSON.stringify(payload), { headers });
    lineCreationLatency.add(res.timings.duration);

    const ok = check(res, {
      "bank line created": (response) => response.status === 201,
    });

    lineErrorRate.add(ok ? 0 : 1);

    if (!ok) {
      return;
    }

    const lineId = res.json("id");

    group("apply allocations", () => {
      const allocationPayload = {
        orgId: ORG_ID,
        allocations: [
          {
            lineId,
            amount: payload.amount,
          },
        ],
      };

      const allocationHeaders = {
        ...headers,
        "Idempotency-Key": IDEMPOTENCY_KEY,
      };

      const applyRes = http.post(
        `${BASE_URL}/allocations/apply`,
        JSON.stringify(allocationPayload),
        { headers: allocationHeaders },
      );

      allocationLatency.add(applyRes.timings.duration);

      const accepted = check(applyRes, {
        "allocation apply accepted": (response) => response.status === 202,
      });

      allocationErrorRate.add(accepted ? 0 : 1);
    });
  });

  if (ITERATION_SLEEP > 0) {
    sleep(ITERATION_SLEEP);
  }
}
