import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const baseUrl = __ENV.API_BASE_URL ?? "http://localhost:3000";
const vus = Number(__ENV.VUS ?? 5);
const duration = __ENV.DURATION ?? "1m";

export const errorRate = new Rate("api_error_rate");
export const bankLineDuration = new Trend("bank_line_duration", true);

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-vus",
      vus,
      duration,
      gracefulStop: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<750"],
    api_error_rate: ["rate<0.05"],
    bank_line_duration: ["avg<500", "p(95)<1000"],
  },
};

function withJsonHeaders(params = {}) {
  const headers = Object.assign({}, params.headers, {
    "Content-Type": "application/json",
  });
  return { ...params, headers };
}

function ensureOk(response, message) {
  const passed = check(response, {
    [message]: (res) => res.status >= 200 && res.status < 300,
  });
  if (!passed) {
    errorRate.add(1);
  }
  return passed;
}

export default function run() {
  group("health-check", () => {
    const response = http.get(`${baseUrl}/health`);
    ensureOk(response, "health endpoint is healthy");
    sleep(1);
  });

  group("list-users", () => {
    const response = http.get(`${baseUrl}/users`);
    ensureOk(response, "users endpoint responds");

    check(response, {
      "users payload is array": (res) => {
        try {
          const body = res.json();
          return Array.isArray(body?.users);
        } catch (error) {
          return false;
        }
      },
    });
    sleep(1);
  });

  group("bank-line-flow", () => {
    const listResponse = http.get(`${baseUrl}/bank-lines?take=5`);
    ensureOk(listResponse, "bank line listing succeeds");

    const payload = {
      orgId: __ENV.LOAD_TEST_ORG_ID ?? "demo-org",
      date: new Date().toISOString(),
      amount: Number(__ENV.LOAD_TEST_AMOUNT ?? 10.5),
      payee: __ENV.LOAD_TEST_PAYEE ?? "k6 smoke test",
      desc: __ENV.LOAD_TEST_DESC ?? "automated load test",
    };

    const start = Date.now();
    const createResponse = http.post(
      `${baseUrl}/bank-lines`,
      JSON.stringify(payload),
      withJsonHeaders(),
    );
    const durationMs = Date.now() - start;
    bankLineDuration.add(durationMs);

    const created = ensureOk(createResponse, "bank line creation succeeds");
    if (created) {
      check(createResponse, {
        "created bank line echoes amount": (res) => {
          try {
            const body = res.json();
            return Number(body?.amount) === payload.amount;
          } catch (error) {
            return false;
          }
        },
      });
    }

    sleep(1);
  });
}
