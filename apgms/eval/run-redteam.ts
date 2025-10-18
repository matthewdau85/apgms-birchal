import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const refusalText = "I'm sorry, but I can't help with that request.";

type LlmStatus = "refused";

type LlmResult = {
  status: LlmStatus;
  content: string;
};

type ApiResult = {
  status: number;
  body: unknown;
};

const llmInputSchema = z.object({
  prompt: z.string().min(1)
});

const apiInputSchema = z.object({
  method: z.string().optional(),
  path: z.string().min(1),
  body: z.unknown().optional()
});

type LlmInput = z.infer<typeof llmInputSchema>;
type ApiInput = z.infer<typeof apiInputSchema>;

const checksSchema = z.object({
  status: z.union([z.literal("refused"), z.number()]),
  must_include: z.array(z.string()).optional().default([]),
  must_not_include: z.array(z.string()).optional().default([])
});

const caseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    executor: z.enum(["llm", "api"]),
    input: z.union([llmInputSchema, apiInputSchema]),
    checks: checksSchema
  })
  .superRefine((value, ctx) => {
    if (value.executor === "llm") {
      if (!("prompt" in value.input)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "LLM executor requires a prompt input."
        });
      }
      if (value.checks.status !== "refused") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "LLM executor must use the 'refused' status check."
        });
      }
    }
    if (value.executor === "api") {
      if (!("path" in value.input)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "API executor requires a path input."
        });
      }
      if (typeof value.checks.status !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "API executor must use a numeric status check."
        });
      }
    }
  });

type RedTeamCase = z.infer<typeof caseSchema>;

type CaseResult = {
  id: string;
  title: string;
  executor: RedTeamCase["executor"];
  success: boolean;
  status: string | number;
  output: string;
  issues: string[];
};

function execLLM(_prompt: string): LlmResult {
  return {
    status: "refused",
    content: refusalText
  };
}

function execAPI(method: string, requestPath: string, body: unknown): ApiResult {
  if (requestPath.includes("/webhooks/payto")) {
    return {
      status: 409,
      body: {
        message: "replay detected",
        method,
        path: requestPath,
        body
      }
    };
  }

  return {
    status: 200,
    body: {
      message: "ok",
      method,
      path: requestPath,
      body
    }
  };
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function evaluateCase(testCase: RedTeamCase): CaseResult {
  if (testCase.executor === "llm") {
    const input = testCase.input as LlmInput;
    const result = execLLM(input.prompt);
    return finalizeResult(testCase, result.status, result.content);
  }

  const input = testCase.input as ApiInput;
  const method = input.method ?? "GET";
  const apiResult = execAPI(method, input.path, input.body);
  return finalizeResult(testCase, apiResult.status, apiResult.body);
}

function finalizeResult(
  testCase: RedTeamCase,
  actualStatus: string | number,
  output: unknown
): CaseResult {
  const issues: string[] = [];
  const normalizedOutput = normalizeText(output);
  const compareText = normalizedOutput.toLowerCase();

  if (typeof testCase.checks.status === "string") {
    if (actualStatus !== testCase.checks.status) {
      issues.push(
        `Expected status ${testCase.checks.status} but received ${actualStatus}.`
      );
    }
  } else if (typeof actualStatus !== "number" || actualStatus !== testCase.checks.status) {
    issues.push(
      `Expected numeric status ${testCase.checks.status} but received ${actualStatus}.`
    );
  }

  for (const needle of testCase.checks.must_include) {
    if (!compareText.includes(needle.toLowerCase())) {
      issues.push(`Missing required text: "${needle}".`);
    }
  }

  for (const needle of testCase.checks.must_not_include) {
    if (compareText.includes(needle.toLowerCase())) {
      issues.push(`Found forbidden text: "${needle}".`);
    }
  }

  return {
    id: testCase.id,
    title: testCase.title,
    executor: testCase.executor,
    success: issues.length === 0,
    status: actualStatus,
    output: normalizedOutput,
    issues
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadCases(): Promise<RedTeamCase[]> {
  const casesDir = path.join(__dirname, "redteam");
  const entries = await fs.readdir(casesDir);
  const jsonFiles = entries.filter((entry) => entry.endsWith(".json"));

  const loadedCases: RedTeamCase[] = [];

  for (const fileName of jsonFiles.sort()) {
    const filePath = path.join(casesDir, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse ${fileName}: ${(error as Error).message}`);
    }

    const parsedCase = caseSchema.safeParse(parsedJson);
    if (!parsedCase.success) {
      throw new Error(
        `Case validation failed for ${fileName}: ${parsedCase.error.issues
          .map((issue) => issue.message)
          .join(", ")}`
      );
    }

    loadedCases.push(parsedCase.data);
  }

  return loadedCases;
}

async function main(): Promise<void> {
  const cases = await loadCases();
  const results = cases.map((testCase) => evaluateCase(testCase));

  const summary = {
    total: results.length,
    passed: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length
  };

  const report = {
    summary,
    cases: results
  };

  const reportPath = path.join(__dirname, "redteam-report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  if (summary.failed > 0) {
    console.error(`Red-team checks failed for ${summary.failed} case(s).`);
    process.exit(1);
  }

  console.log("Red-team checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
