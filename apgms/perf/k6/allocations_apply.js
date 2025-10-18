import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL ?? "http://127.0.0.1:3300"}/allocations/apply`);
  check(res, {
    "status is 200": (r) => r.status === 200,
  });
  sleep(1);
}
