import fs from "fs";
import path from "path";

type Case = {
  id: string;
  kind: "route";
  route: "allocations.apply" | "allocations.preview" | "dashboard";
  input: any;
  expect: { valid_schema: boolean; rules: string[] };
};

function validateSchema(route: string, output: any): boolean {
  try {
    if (route.startsWith("dashboard")) {
      return !!(output && output.kpis && output.series !== undefined);
    }
    if (route.startsWith("allocations.")) {
      return !!(output && output.policyHash && Array.isArray(output.allocations));
    }
    return false;
  } catch {
    return false;
  }
}

function conservationOK(input: any, output: any): boolean {
  const sum = (output.allocations || []).reduce((a: number, b: any) => a + (b.amountCents || 0), 0);
  return sum === Number(input.bankLine?.amountCents);
}
function nonNegativeOK(output: any): boolean {
  return (output.allocations || []).every((a: any) => typeof a.amountCents === "number" && a.amountCents >= 0);
}
function gateRespected(_input: any, output: any): boolean {
  // Placeholder rule: if gateOpen === false, remitted must not be true.
  return output.gateOpen === false ? output.remitted !== true : true;
}

function loadCases(dir: string): Case[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

// ---- Replace with real HTTP calls later ----
async function execRoute(route: string, input: any): Promise<any> {
  if (route === "dashboard") {
    return { kpis: { operating: 0, taxBuffer: 0, paygw: 0, gst: 0 }, series: [] };
  }
  if (route === "allocations.preview") {
    if (typeof input?.bankLine?.amountCents !== "number") throw new Error("schema_error");
    const amt = input.bankLine.amountCents;
    const tax = Math.round(amt * 0.1);
    return {
      allocations: [
        { bucket: "OPERATING", amountCents: amt - tax, currency: "AUD" },
        { bucket: "TAX_BUFFER", amountCents: tax, currency: "AUD" }
      ],
      policyHash: "hash_demo",
      gateOpen: true
    };
  }
  if (route === "allocations.apply") {
    return { allocations: [], policyHash: "hash_demo", gateOpen: false, remitted: false };
  }
  throw new Error("unsupported_route");
}

(async () => {
  const dir = path.join(process.cwd(), "eval", "golden");
  const cases = loadCases(dir);
  let schemaOK = 0,
    schemaTotal = 0,
    rulesPass = 0,
    rulesTotal = 0;
  const fails: string[] = [];

  for (const c of cases) {
    let out: any;
    try {
      out = await execRoute(c.route, c.input);
    } catch (e: any) {
      if (c.expect.valid_schema === false && String(e?.message).includes("schema_error")) {
        // Expected schema failure → counts as handled; don't increment schema totals.
        continue;
      } else {
        fails.push(`${c.id}: exec error ${e?.message ?? e}`);
        continue;
      }
    }

    const okSchema = validateSchema(c.route, out);
    schemaTotal++;
    if (okSchema) schemaOK++;
    if ((c.expect.valid_schema ?? true) && !okSchema) {
      fails.push(`${c.id}: schema invalid`);
      continue;
    }

    for (const r of c.expect.rules || []) {
      rulesTotal++;
      let ok = true;
      if (r === "conservation") ok = conservationOK(c.input, out);
      if (r === "non_negative") ok = nonNegativeOK(out);
      if (r === "gate_respected") ok = gateRespected(c.input, out);
      if (ok) rulesPass++;
      else fails.push(`${c.id}: rule ${r} failed`);
    }
  }

  const schemaValidity = schemaTotal ? schemaOK / schemaTotal : 1;
  const passRate = rulesTotal ? rulesPass / rulesTotal : 1;

  console.log(`Schema validity: ${(schemaValidity * 100).toFixed(1)}%`);
  console.log(`Rule pass rate:  ${(passRate * 100).toFixed(1)}%`);

  if (schemaValidity < 0.98 || passRate < 0.90) {
    console.error("Golden gate FAILED");
    fails.forEach((f) => console.error(" -", f));
    process.exit(1);
  } else {
    console.log("Golden gate PASSED");
  }
})();
