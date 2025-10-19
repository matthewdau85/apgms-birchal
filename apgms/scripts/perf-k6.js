import http from "k6/http";
import { check, group, sleep, Trend } from "k6";

const baseUrl = __ENV.BASE_URL || "http://127.0.0.1:3000";
const vus = Number(__ENV.VUS || 5);
const duration = __ENV.DURATION || "1m";
const sleepSeconds = Number(__ENV.SLEEP_SECONDS || 1);
const latencySloMs = Number(__ENV.ALLOCATIONS_LATENCY_SLO_MS || 250);
const errorBudgetRate = Number(__ENV.ERROR_BUDGET_RATE || 0.01);

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: [`rate<${errorBudgetRate}`],
    allocations_apply_duration: [`p(95)<${latencySloMs}`],
  },
};

const allocationsTrend = new Trend("allocations_apply_duration", true);

const defaultHeaders = {
  "Content-Type": "application/json",
};

function request(method, path, payload = null, params = {}) {
  const url = `${baseUrl}${path}`;
  const opts = { headers: { ...defaultHeaders, ...(params.headers || {}) }, tags: params.tags };
  let response;
  if (method === "GET") {
    response = http.get(url, opts);
  } else if (method === "POST") {
    response = http.post(url, payload, opts);
  } else {
    throw new Error(`Unsupported method: ${method}`);
  }
  return response;
}

export default function () {
  group("health", () => {
    const res = request("GET", "/health", null, { tags: { endpoint: "/health" } });
    let okFlag = false;
    try {
      okFlag = res.json("ok") === true;
    } catch (err) {
      okFlag = false;
    }
    check(res, {
      "health is ok": (r) => r.status === 200 && (okFlag || r.body.length > 0),
    });
  });

  group("list users", () => {
    const res = request("GET", "/users", null, { tags: { endpoint: "/users" } });
    check(res, {
      "users listed": (r) => r.status === 200 || r.status === 204,
    });
  });

  group("list bank lines", () => {
    const res = request("GET", "/bank-lines", null, { tags: { endpoint: "/bank-lines", method: "GET" } });
    check(res, {
      "bank lines listed": (r) => r.status === 200 || r.status === 204,
    });
  });

  group("apply allocation", () => {
    const payload = JSON.stringify({
      orgId: __ENV.TEST_ORG_ID || "org-perf",
      date: new Date().toISOString(),
      amount: 100.25,
      payee: "Perf Harness",
      desc: "Synthetic allocation",
    });
    const res = request("POST", "/bank-lines", payload, { tags: { endpoint: "/bank-lines", method: "POST" } });
    allocationsTrend.add(res.timings.duration);
    check(res, {
      "apply succeeded": (r) => r.status === 201 || r.status === 200,
    });
  });

  sleep(sleepSeconds);
}

export function handleSummary(data) {
  const summary = JSON.stringify(data, null, 2);
  return {
    stdout: summary,
    "k6-report.json": summary,
  };
}
