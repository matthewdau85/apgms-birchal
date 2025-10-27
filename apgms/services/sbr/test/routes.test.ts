import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app";
import type {
  BasSubmissionHandler,
  BasSubmissionPayload,
  PayrollSubmissionHandler,
  PayrollSubmissionPayload,
} from "../src/handlers";

const basResult = {
  receiptId: "ABC123",
  lodgementTime: "2024-06-01T00:00:00Z",
  status: "ACCEPTED" as const,
};

const payrollResult = {
  receiptId: "PAY123",
  lodgementTime: "2024-06-02T00:00:00Z",
  status: "RECEIVED" as const,
};

type BasStub = Pick<BasSubmissionHandler, "submit"> & { calls: BasSubmissionPayload[] };
type PayrollStub = Pick<PayrollSubmissionHandler, "submit"> & {
  calls: PayrollSubmissionPayload[];
};

function createBasStub(): BasStub {
  const calls: BasSubmissionPayload[] = [];
  return {
    calls,
    async submit(payload: BasSubmissionPayload) {
      calls.push(payload);
      return basResult;
    },
  };
}

function createPayrollStub(): PayrollStub {
  const calls: PayrollSubmissionPayload[] = [];
  return {
    calls,
    async submit(payload: PayrollSubmissionPayload) {
      calls.push(payload);
      return payrollResult;
    },
  };
}

test("BAS endpoint validates payloads and triggers submissions", async () => {
  const basHandler = createBasStub();
  const payrollHandler = createPayrollStub();
  const app = createServer({
    basHandler: basHandler as unknown as BasSubmissionHandler,
    payrollHandler: payrollHandler as unknown as PayrollSubmissionHandler,
    logger: false,
  });

  const invalid = await app.inject({
    method: "POST",
    url: "/lodgements/bas",
    payload: { abn: "123", period: "2024-06", grossSales: 10, gstOnSales: 1, gstOnPurchases: 0 },
  });

  assert.equal(invalid.statusCode, 400);

  const valid = await app.inject({
    method: "POST",
    url: "/lodgements/bas",
    payload: {
      abn: "12345678901",
      period: "2024-06",
      grossSales: 10000,
      gstOnSales: 1000,
      gstOnPurchases: 400,
    },
  });

  assert.equal(valid.statusCode, 202);
  assert.equal(basHandler.calls.length, 1);

  await app.close();
});

test("Payroll endpoint validates payloads and triggers submissions", async () => {
  const basHandler = createBasStub();
  const payrollHandler = createPayrollStub();
  const app = createServer({
    basHandler: basHandler as unknown as BasSubmissionHandler,
    payrollHandler: payrollHandler as unknown as PayrollSubmissionHandler,
    logger: false,
  });

  const invalid = await app.inject({
    method: "POST",
    url: "/lodgements/payroll",
    payload: {
      abn: "12345678901",
      payPeriodStart: "2024-06-01",
      payPeriodEnd: "2024-06-15",
      employees: [],
    },
  });

  assert.equal(invalid.statusCode, 400);

  const valid = await app.inject({
    method: "POST",
    url: "/lodgements/payroll",
    payload: {
      abn: "12345678901",
      payPeriodStart: "2024-06-01",
      payPeriodEnd: "2024-06-15",
      employees: [{ tfnd: "123456789", gross: 5000, taxWithheld: 1200 }],
    },
  });

  assert.equal(valid.statusCode, 202);
  assert.equal(payrollHandler.calls.length, 1);

  await app.close();
});
