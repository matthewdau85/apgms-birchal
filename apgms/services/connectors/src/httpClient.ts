export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type ResponseType = "json" | "text" | "buffer" | "none";

export interface HttpClientOptions {
  baseUrl?: string;
  defaultHeaders?: HeadersInit;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  logger?: Pick<Console, "debug" | "warn" | "error">;
  circuitBreaker?: Partial<CircuitBreakerOptions>;
}

export interface RequestOptions {
  path?: string;
  url?: string;
  method?: HttpMethod;
  headers?: HeadersInit;
  body?: unknown;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  responseType?: ResponseType;
  signal?: AbortSignal;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
  url: string;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  resetTimeout: number;
}

const DEFAULT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 10_000,
};

export class CircuitBreakerOpenError extends Error {
  constructor(message = "Circuit breaker is open") {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

export class HttpClientError extends Error {
  public readonly status?: number;
  public readonly attempt: number;
  public readonly retryable: boolean;
  public readonly response?: Response;

  constructor(
    message: string,
    options: {
      status?: number;
      attempt: number;
      retryable: boolean;
      response?: Response;
    },
  ) {
    super(message);
    this.name = "HttpClientError";
    this.status = options.status;
    this.attempt = options.attempt;
    this.retryable = options.retryable;
    this.response = options.response;
  }
}

class SimpleCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeout: number;

  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    const resolved = { ...DEFAULT_BREAKER_OPTIONS, ...options };
    this.failureThreshold = resolved.failureThreshold;
    this.successThreshold = resolved.successThreshold;
    this.resetTimeout = resolved.resetTimeout;
  }

  async run<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() >= this.nextAttempt) {
        this.state = "half-open";
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this.reset();
      }
    } else {
      this.reset();
    }
  }

  private onFailure(): void {
    this.failureCount += 1;

    if (this.state === "half-open") {
      this.trip();
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.trip();
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.state = "closed";
    this.nextAttempt = 0;
  }

  private trip(): void {
    this.state = "open";
    this.successCount = 0;
    this.nextAttempt = Date.now() + this.resetTimeout;
  }
}

function mergeHeaders(base?: HeadersInit, extra?: HeadersInit): HeadersInit {
  const headers = new Headers(base ?? {});
  if (extra) {
    const toMerge = new Headers(extra);
    toMerge.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toUrl(baseUrl: string, options: RequestOptions): string {
  if (options.url) {
    return options.url;
  }
  const path = options.path ?? "";
  if (!baseUrl) {
    throw new Error("A baseUrl must be configured when using relative paths");
  }
  const joined = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  return joined.toString();
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: HeadersInit;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly breaker: SimpleCircuitBreaker;
  private readonly logger?: Pick<Console, "debug" | "warn" | "error">;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.timeout = options.timeout ?? 5_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelay = options.retryDelay ?? 250;
    this.logger = options.logger;
    this.breaker = new SimpleCircuitBreaker(options.circuitBreaker);
  }

  async request<T = unknown>(options: RequestOptions): Promise<HttpResponse<T>> {
    return this.breaker.run(async () => this.executeWithRetries<T>(options));
  }

  private async executeWithRetries<T>(options: RequestOptions): Promise<HttpResponse<T>> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const retryDelay = options.retryDelay ?? this.retryDelay;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      try {
        return await this.performRequest<T>(options, attempt + 1);
      } catch (error) {
        lastError = error;
        const httpError = error instanceof HttpClientError ? error : undefined;

        if (!httpError?.retryable || attempt === maxRetries) {
          throw error;
        }

        this.logger?.warn?.(
          `HTTP request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${retryDelay}ms: ${httpError.message}`,
        );
        await delay(retryDelay);
      }
      attempt += 1;
    }

    throw lastError instanceof Error ? lastError : new Error("HTTP request failed");
  }

  private async performRequest<T>(options: RequestOptions, attempt: number): Promise<HttpResponse<T>> {
    const url = toUrl(this.baseUrl, options);
    const method = options.method ?? "GET";
    const responseType = options.responseType ?? "json";
    const timeout = options.timeout ?? this.timeout;

    const headers = mergeHeaders(this.defaultHeaders, options.headers);
    const controller = new AbortController();
    const signal = options.signal ?? controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let body = options.body;
    if (body && typeof body === "object" && !(body instanceof ArrayBuffer) && !(body instanceof URLSearchParams)) {
      body = JSON.stringify(body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body as BodyInit | null | undefined,
        signal,
      });

      if (!response.ok) {
        const retryable = this.isRetryableStatus(response.status);
        throw new HttpClientError(`Request to ${url} failed with status ${response.status}`, {
          status: response.status,
          attempt,
          retryable,
          response,
        });
      }

      const data = await this.parseResponse<T>(response, responseType);
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        url,
      };
    } catch (error) {
      if (error instanceof HttpClientError) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new HttpClientError(`Request to ${url} timed out after ${timeout}ms`, {
          attempt,
          retryable: true,
        });
      }

      throw new HttpClientError(`Request to ${url} failed: ${(error as Error).message}`, {
        attempt,
        retryable: true,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isRetryableStatus(status: number): boolean {
    if (status >= 500) return true;
    return status === 408 || status === 425 || status === 429;
  }

  private async parseResponse<T>(response: Response, responseType: ResponseType): Promise<T> {
    switch (responseType) {
      case "json":
        if (response.status === 204) {
          return undefined as T;
        }
        return (await response.json()) as T;
      case "text":
        return (await response.text()) as T;
      case "buffer":
        return (await response.arrayBuffer()) as T;
      case "none":
      default:
        return undefined as T;
    }
  }
}
