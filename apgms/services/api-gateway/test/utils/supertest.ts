import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

type RequestInit = {
  method: HttpMethod;
  url: string;
};

type SuperTestResponse = LightMyRequestResponse & {
  status: number;
  text: string;
  body: any;
  json(): any;
};

class RequestBuilder implements PromiseLike<SuperTestResponse> {
  #app: FastifyInstance;
  #init: RequestInit;
  #payload: unknown;

  constructor(app: FastifyInstance, init: RequestInit) {
    this.#app = app;
    this.#init = init;
  }

  send(body: unknown): this {
    this.#payload = body;
    return this;
  }

  then<TResult1 = SuperTestResponse, TResult2 = never>(
    onfulfilled?: ((value: SuperTestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.#execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<SuperTestResponse | TResult> {
    return this.#execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<SuperTestResponse> {
    return this.#execute().finally(onfinally ?? undefined);
  }

  #execute(): Promise<SuperTestResponse> {
    const headers: Record<string, string> = {};
    const payload = this.#payload;
    if (payload !== undefined && typeof payload !== "string") {
      headers["content-type"] = "application/json";
    }

    const options: InjectOptions = {
      method: this.#init.method,
      url: this.#init.url,
      payload,
      headers,
    };

    return this.#app.inject(options).then(adaptResponse);
  }
}

function adaptResponse(res: LightMyRequestResponse): SuperTestResponse {
  let parsed: any;
  let isJson = false;
  try {
    parsed = res.json();
    isJson = true;
  } catch {
    parsed = res.body;
  }

  const text = typeof res.body === "string" ? res.body : JSON.stringify(res.body);

  const response: SuperTestResponse = Object.assign(res, {
    status: res.statusCode,
    text,
    body: isJson ? parsed : res.body,
    json: () => (isJson ? parsed : JSON.parse(String(res.body))),
  });

  return response;
}

function createRequest(app: FastifyInstance) {
  const make = (method: HttpMethod, url: string) => new RequestBuilder(app, { method, url });
  return {
    get: (url: string) => make("GET", url),
    post: (url: string) => make("POST", url),
    put: (url: string) => make("PUT", url),
    patch: (url: string) => make("PATCH", url),
    delete: (url: string) => make("DELETE", url),
    head: (url: string) => make("HEAD", url),
    options: (url: string) => make("OPTIONS", url),
  };
}

export default createRequest;
