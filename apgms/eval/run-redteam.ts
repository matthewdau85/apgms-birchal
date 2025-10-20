import axios, { AxiosInstance } from "axios";
import process from "node:process";

export type RedteamCase = {
  id: string;
  name?: string;
  title?: string;
  kind: "api" | "llm";
  payload?: Record<string, unknown>;
  input?: Record<string, unknown>;
};

type ApiExecutor = (testCase: RedteamCase) => Promise<unknown>;
type LlmExecutor = (testCase: RedteamCase) => Promise<unknown>;

type LoadedCasesModule = {
  default?: RedteamCase[];
  cases?: RedteamCase[];
  getCases?: () => Promise<RedteamCase[]> | RedteamCase[];
};

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  validateStatus: () => true,
});

const LLM_URL = process.env.LLM_URL;

const apiExecutors: Record<string, ApiExecutor> = {
  "replay webhook": async (testCase) => executeReplayWebhook(testCase),
};

const llmExecutor: LlmExecutor = async (testCase) => {
  const prompt =
    (testCase.payload?.prompt as string | undefined) ??
    (testCase.input?.prompt as string | undefined);
  if (!LLM_URL) {
    return {
      refused: true,
      reason: "LLM_URL is not configured",
      prompt,
    };
  }

  const body = {
    prompt,
    context:
      (testCase.payload?.context as string | undefined) ??
      (testCase.input?.context as string | undefined),
    metadata: {
      caseId: testCase.id,
      caseName: getCaseName(testCase),
    },
  };

  const response = await axios.post(LLM_URL, body, {
    timeout: 60_000,
    validateStatus: () => true,
  });

  return {
    status: response.status,
    data: response.data,
  };
};

async function executeReplayWebhook(testCase: RedteamCase) {
  const payload = {
    event: "payto.transfer.completed",
    amount: 123_45,
    currency: "AUD",
    account: {
      bsb: "123-456",
      accountNumber: "12345678",
    },
    ...(testCase.payload as Record<string, unknown>),
  };

  const staleTimestamp =
    (payload.timestamp as string | undefined) ??
    new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
  const nonce = (payload.nonce as string | undefined) ?? "replayed-nonce";

  const requestBody = {
    ...payload,
    timestamp: staleTimestamp,
    nonce,
  };

  const signatureHeader =
    (payload.signature as string | undefined) ??
    `ts=${Math.floor(new Date(staleTimestamp).getTime() / 1000)};nonce=${nonce}`;

  const headers = {
    "content-type": "application/json",
    "x-payto-signature": signatureHeader,
  };

  const firstAttempt = await withApiClient(() =>
    apiClient.post("/webhooks/payto", requestBody, { headers })
  );

  const replayAttempt = await withApiClient(() =>
    apiClient.post("/webhooks/payto", requestBody, { headers })
  );

  return {
    first: {
      status: firstAttempt.status,
      data: firstAttempt.data,
    },
    replay: {
      status: replayAttempt.status,
      data: replayAttempt.data,
    },
  };
}

async function withApiClient<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isConnectionError(error)) {
      console.error(
        `[redteam] Failed to connect to API at ${API_BASE_URL}. Ensure the API gateway is running (npm run dev-api or docker compose up).`
      );
      process.exit(1);
    }
    throw error;
  }
}

function isConnectionError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  return (
    error.code === "ECONNREFUSED" ||
    error.code === "ECONNRESET" ||
    (error.cause as NodeJS.ErrnoException | undefined)?.code === "ECONNREFUSED"
  );
}

function getCaseName(testCase: RedteamCase): string {
  return (
    testCase.title ??
    testCase.name ??
    (testCase.payload?.name as string | undefined) ??
    testCase.id
  );
}

async function loadCases(): Promise<RedteamCase[]> {
  const candidates = [
    "./cases/index.ts",
    "./cases/index.js",
    "./cases.ts",
    "./cases.js",
  ];

  for (const candidate of candidates) {
    try {
      const mod = (await import(candidate)) as LoadedCasesModule;
      const loaded = await resolveCasesFromModule(mod);
      if (Array.isArray(loaded)) {
        return loaded;
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as any).code === "ERR_MODULE_NOT_FOUND") {
        continue;
      }
      throw error;
    }
  }

  return [];
}

async function resolveCasesFromModule(module: LoadedCasesModule): Promise<RedteamCase[] | undefined> {
  if (Array.isArray(module.default)) {
    return module.default;
  }

  if (Array.isArray(module.cases)) {
    return module.cases;
  }

  if (typeof module.getCases === "function") {
    const result = await module.getCases();
    if (Array.isArray(result)) {
      return result;
    }
  }

  return undefined;
}

async function executeCase(testCase: RedteamCase): Promise<unknown> {
  if (testCase.kind === "api") {
    const nameKey = getCaseName(testCase).toLowerCase();
    const executor = apiExecutors[nameKey];
    if (!executor) {
      throw new Error(`No executor registered for API case: ${getCaseName(testCase)}`);
    }
    return executor(testCase);
  }

  if (testCase.kind === "llm") {
    return llmExecutor(testCase);
  }

  throw new Error(`Unknown case kind: ${(testCase as any).kind}`);
}

async function run() {
  const cases = await loadCases();
  if (!cases.length) {
    console.warn("[redteam] No cases loaded. Nothing to run.");
    return;
  }

  let failures = 0;

  for (const testCase of cases) {
    const name = getCaseName(testCase);
    try {
      const result = await executeCase(testCase);
      console.log(
        JSON.stringify(
          {
            id: testCase.id,
            name,
            kind: testCase.kind,
            result,
          },
          null,
          2
        )
      );
    } catch (error) {
      failures += 1;
      console.error(`[redteam] Case '${name}' failed:`, error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  if (isConnectionError(error)) {
    console.error(
      `[redteam] Failed to connect to API at ${API_BASE_URL}. Ensure the API gateway is running (npm run dev-api or docker compose up).`
    );
    process.exit(1);
    return;
  }

  console.error("[redteam] Unhandled error:", error);
  process.exit(1);
});
