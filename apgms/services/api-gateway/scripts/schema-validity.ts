import { bankLinesResponseSchema } from "../src/schemas/responses.js";

const SAMPLE_SIZE = 50;

const sampleLine = {
  id: "line-0",
  orgId: "org-0",
  date: new Date().toISOString(),
  amount: "125.45",
  payee: "Acme Corp",
  desc: "Synthetic data point",
  createdAt: new Date().toISOString(),
};

const suite = Array.from({ length: SAMPLE_SIZE }, (_, index) => ({
  lines: [
    {
      ...sampleLine,
      id: `line-${index}`,
      orgId: `org-${index % 5}`,
      amount: (100 + index * 3.14).toFixed(2),
      payee: index % 2 === 0 ? "Acme Corp" : "Globex",
      desc: `Synthetic data point ${index}`,
      date: new Date(Date.now() - index * 86_400_000).toISOString(),
      createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    },
  ],
}));

let passes = 0;
const failures: Array<{ index: number; error: unknown }> = [];

suite.forEach((payload, index) => {
  const validation = bankLinesResponseSchema.safeParse(payload);
  if (validation.success) {
    passes += 1;
    return;
  }
  failures.push({ index, error: validation.error.flatten() });
});

const passRate = passes / suite.length;

console.log(
  `Schema validity pass rate: ${(passRate * 100).toFixed(2)}% (${passes}/${suite.length})`
);

if (passRate <= 0.98) {
  console.error("Schema validity below threshold (98%)");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

if (failures.length > 0) {
  console.warn("Some samples failed validation but threshold was satisfied");
  console.warn(JSON.stringify(failures, null, 2));
}
