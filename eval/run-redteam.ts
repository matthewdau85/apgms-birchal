import fs from "fs";
import path from "path";

type Case = {
  id: string;
  kind: "llm" | "api";
  title: string;
  prompt: string;
  expected: "refuse" | "error" | "allowed";
  checks: string[];
  metadata?: Record<string, unknown>;
};

function readCases(dir: string): Case[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

// ---- PLUG YOUR SYSTEM HERE (temporary stubs) ---- //
async function execLLM(prompt: string): Promise<{ text: string; status?: number }> {
  // Placeholder: until you wire your LLM, always return a refusal
  return { text: "I must refuse this request.", status: 200 };
}
async function execAPI(spec: string): Promise<{ text: string; status: number }> {
  // Placeholder: simulate your webhook refusing a replay
  if (spec.toLowerCase().includes("webhooks/payto")) return { text: "replay detected", status: 409 };
  return { text: "OK", status: 200 };
}
// ------------------------------------------------- //

function check(_caseId: string, out: { text: string; status?: number }, checks: string[]): string[] {
  const fails: string[] = [];
  const text = (out.text ?? "").toLowerCase();
  const status = out.status ?? 200;

  for (const c of checks) {
    if (c.startsWith("must_include:")) {
      const want = c.split(":")[1]?.toLowerCase() ?? "";
      if (!text.includes(want)) fails.push(`missing "${want}"`);
    } else if (c.startsWith("must_not_include:")) {
      const ban = c.split(":")[1]?.toLowerCase() ?? "";
      if (text.includes(ban)) fails.push(`should not include "${ban}"`);
    } else if (c.startsWith("status:")) {
      const expr = c.split(":")[1] ?? "";
      if (expr.startsWith(">=")) {
        const n = Number(expr.slice(2));
        if (!(status >= n)) fails.push(`status ${status} !>= ${n}`);
      } else if (expr.startsWith("==")) {
        const n = Number(expr.slice(2));
        if (status !== n) fails.push(`status ${status} !== ${n}`);
      }
    }
  }
  return fails;
}

(async () => {
  const dir = path.join(process.cwd(), "eval", "redteam");
  const cases = readCases(dir);
  let failed = 0;

  for (const k of cases) {
    const out = k.kind === "llm" ? await execLLM(k.prompt) : await execAPI(k.prompt);
    const errs = check(k.id, out, k.checks);
    const ok = errs.length === 0;
    console.log(`${ok ? "✅" : "❌"} ${k.id} — ${k.title}`);
    if (!ok) {
      failed++;
      console.log("  Output:", out);
      console.log("  Fails:", errs.join("; "));
    }
  }

  if (failed > 0) {
    console.error(`Red-team failed: ${failed}/${cases.length} cases`);
    process.exit(1);
  } else {
    console.log(`Red-team passed: ${cases.length}/${cases.length}`);
  }
})();
