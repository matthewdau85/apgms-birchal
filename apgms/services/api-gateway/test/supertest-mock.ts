import type { FastifyInstance, InjectOptions } from "fastify";

type SupertestResponse = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
};

type SupertestRequest = {
  set: (name: string, value: string) => SupertestRequest;
  send: (body: InjectOptions["payload"]) => SupertestRequest;
  then: <TResult1 = SupertestResponse, TResult2 = never>(
    onFulfilled?: (value: SupertestResponse) => TResult1 | PromiseLike<TResult1>,
    onRejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onRejected?: (reason: unknown) => TResult | PromiseLike<TResult>,
  ) => Promise<SupertestResponse | TResult>;
  finally: (onFinally?: () => void) => Promise<SupertestResponse>;
};

const parseBody = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) {
    return undefined;
  }

  if (Buffer.isBuffer(raw)) {
    return parseBody(raw.toString("utf8"));
  }

  if (typeof raw !== "string") {
    return raw;
  }

  if (raw === "") {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const normalizeHeaders = (input: unknown): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!input || typeof input !== "object") {
    return result;
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) => String(item)).join(", ");
    } else if (value !== undefined) {
      result[key] = String(value);
    }
  }

  return result;
};

const createRequest = (
  app: FastifyInstance,
  options: Pick<InjectOptions, "method" | "url">,
): SupertestRequest => {
  const headers: Record<string, string> = {};
  let payload: InjectOptions["payload"];

  const execute = async (): Promise<SupertestResponse> => {
    const response: any = await app.inject({
      ...options,
      headers,
      payload,
    });

    return {
      status: response.statusCode as number,
      body: parseBody(response.body),
      headers: normalizeHeaders(response.headers),
    };
  };

  const request: SupertestRequest = {
    set(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return request;
    },
    send(body: InjectOptions["payload"]) {
      payload = body;
      return request;
    },
    then(onFulfilled, onRejected) {
      return execute().then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return execute().catch(onRejected);
    },
    finally(onFinally) {
      return execute().finally(onFinally);
    },
  };

  return request;
};

const request = (app: FastifyInstance) => ({
  get: (url: string) => createRequest(app, { method: "GET", url }),
  post: (url: string) => createRequest(app, { method: "POST", url }),
});

export default request;
export type { SupertestResponse, SupertestRequest };
