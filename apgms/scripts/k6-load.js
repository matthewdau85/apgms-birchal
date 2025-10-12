import http from "k6/http";
import { Trend } from "k6/metrics";
import { check, sleep } from "k6";

const compileTrend = new Trend("bas_compile_duration");
const debitTrend = new Trend("payments_debit_duration");

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-arrival-rate",
      rate: 6,
      timeUnit: "1m",
      duration: "1m",
      preAllocatedVUs: 3
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<250"],
    bas_compile_duration: ["p(95)<250"],
    payments_debit_duration: ["p(95)<250"]
  }
};

const BASE_URL = __ENV.BASE_URL ?? "http://localhost:3000";

export default function () {
  const compilePayload = JSON.stringify({
    profileId: "ent-demo",
    transactions: [
      { id: "s-1", type: "sale", amount: 1000, gst: 0.1 },
      { id: "e-1", type: "expense", amount: 200, gst: 0.1 }
    ]
  });

  const compileResponse = http.post(`${BASE_URL}/bas/compile`, compilePayload, {
    headers: { "Content-Type": "application/json" }
  });
  compileTrend.add(compileResponse.timings.duration);
  check(compileResponse, {
    "compile status acceptable": (res) => res.status === 200 || res.status === 202
  });

  const debitResponse = http.post(
    `${BASE_URL}/payments/debit`,
    JSON.stringify({ amount: 880, source: "demo", currency: "AUD" }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
  debitTrend.add(debitResponse.timings.duration);
  check(debitResponse, {
    "debit status acceptable": (res) => res.status === 200 || res.status === 202
  });

  sleep(1);
}
