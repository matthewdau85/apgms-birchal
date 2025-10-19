export class CircuitOpenError extends Error {
  public readonly retryAt: number | null;

  constructor(retryAt: number | null = null, message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitOpenError';
    this.retryAt = retryAt;
  }
}

export class RequestTimeoutError extends Error {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, message = `Request timed out after ${timeoutMs}ms`) {
    super(message);
    this.name = 'RequestTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export interface RetryOptions {
  /** Number of retry attempts after the initial request. */
  retries: number;
  /** Base delay before the first retry attempt. */
  baseDelayMs: number;
  /** Optional maximum backoff delay. */
  maxDelayMs?: number;
  /** Fractional jitter applied to the calculated delay (0.1 = 10%). */
  jitterRatio?: number;
  /** Optional predicate to decide whether the operation should be retried. */
  retryOn?: (context: { response?: Response; error?: unknown; attempt: number }) => boolean;
}

export interface CircuitBreakerOptions {
  /** Number of consecutive qualifying failures before tripping the circuit. */
  failureThreshold: number;
  /** How long the circuit remains open before transitioning to half-open. */
  resetTimeoutMs: number;
  /** Maximum concurrent requests allowed while half-open. */
  halfOpenMaxConcurrency?: number;
}

export interface OutboundHttpClientOptions {
  defaultTimeoutMs?: number;
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
  fetchImpl?: typeof fetch;
}

export interface OutboundRequestInit extends RequestInit {
  timeoutMs?: number;
  retry?: Partial<RetryOptions>;
}

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitTracker {
  state: CircuitState;
  failureCount: number;
  nextAttemptAt: number;
  halfOpenInFlight: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class OutboundHttpClient {
  private readonly defaultTimeoutMs?: number;
  private readonly retryOptions?: RetryOptions;
  private readonly circuitBreakerOptions?: CircuitBreakerOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly circuit: CircuitTracker | null;

  constructor(options: OutboundHttpClientOptions = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs;
    this.retryOptions = options.retry;
    this.circuitBreakerOptions = options.circuitBreaker;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

    this.circuit = this.circuitBreakerOptions
      ? {
          state: 'closed',
          failureCount: 0,
          nextAttemptAt: 0,
          halfOpenInFlight: 0,
        }
      : null;
  }

  async request(input: RequestInfo | URL, init: OutboundRequestInit = {}): Promise<Response> {
    const retryConfig = this.buildRetryConfig(init.retry);
    const timeoutMs = init.timeoutMs ?? this.defaultTimeoutMs;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retryConfig.retries) {
      try {
        const release = this.enterCircuit();
        let response: Response | undefined;
        try {
          response = await this.performRequest(input, init, timeoutMs);
        } finally {
          release();
        }

        if (this.isFailureStatus(response.status)) {
          const shouldRetry =
            attempt < retryConfig.retries &&
            retryConfig.retryOn({ response, attempt });

          if (!shouldRetry) {
            this.recordFailure(response.status);
            return response;
          }

          lastError = response;
          attempt += 1;
          await sleep(this.computeDelay(attempt, retryConfig));
          continue;
        }

        this.recordSuccess();
        return response;
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          throw error;
        }

        const shouldRetry =
          attempt < retryConfig.retries &&
          retryConfig.retryOn({ error, attempt });

        if (!shouldRetry) {
          if (error instanceof RequestTimeoutError) {
            this.recordFailure();
          } else if (!(error instanceof Error && error.name === 'AbortError')) {
            this.recordFailure();
          }
          throw error;
        }

        lastError = error;
        attempt += 1;
        await sleep(this.computeDelay(attempt, retryConfig));
      }
    }

    // Exhausted retries; propagate the last error.
    if (lastError instanceof Response) {
      this.recordFailure(lastError.status);
      return lastError;
    }

    this.recordFailure();
    throw lastError ?? new Error('Request failed after retries');
  }

  private buildRetryConfig(overrides?: Partial<RetryOptions>): Required<RetryOptions> {
    const base: RetryOptions = this.retryOptions ?? {
      retries: 2,
      baseDelayMs: 100,
      jitterRatio: 0.2,
      retryOn: ({ response, error }) => {
        if (response) {
          return this.isFailureStatus(response.status);
        }
        return Boolean(error);
      },
    };

    const merged: RetryOptions = {
      ...base,
      ...overrides,
      retryOn: overrides?.retryOn ?? base.retryOn,
    };

    return {
      retries: merged.retries,
      baseDelayMs: merged.baseDelayMs,
      maxDelayMs: merged.maxDelayMs ?? merged.baseDelayMs * 8,
      jitterRatio: merged.jitterRatio ?? 0.2,
      retryOn:
        merged.retryOn ??
        (({ response, error }) => {
          if (response) {
            return this.isFailureStatus(response.status);
          }
          return Boolean(error);
        }),
    };
  }

  private computeDelay(attempt: number, config: Required<RetryOptions>): number {
    const exponential = config.baseDelayMs * 2 ** (attempt - 1);
    const capped = Math.min(exponential, config.maxDelayMs);
    const jitter = capped * Math.max(0, Math.min(config.jitterRatio, 1));
    return capped + Math.random() * jitter;
  }

  private enterCircuit(): () => void {
    if (!this.circuit || !this.circuitBreakerOptions) {
      return () => undefined;
    }

    const now = Date.now();
    if (this.circuit.state === 'open') {
      if (now >= this.circuit.nextAttemptAt) {
        this.circuit.state = 'half-open';
        this.circuit.halfOpenInFlight = 1;
      } else {
        throw new CircuitOpenError(this.circuit.nextAttemptAt);
      }
    } else if (this.circuit.state === 'half-open') {
      const maxConcurrency = this.circuitBreakerOptions.halfOpenMaxConcurrency ?? 1;
      if (this.circuit.halfOpenInFlight >= maxConcurrency) {
        throw new CircuitOpenError(this.circuit.nextAttemptAt || now);
      }
      this.circuit.halfOpenInFlight += 1;
    }

    return () => {
      if (this.circuit?.state === 'half-open') {
        this.circuit.halfOpenInFlight = Math.max(0, this.circuit.halfOpenInFlight - 1);
      }
    };
  }

  private recordFailure(status?: number): void {
    if (!this.circuit || !this.circuitBreakerOptions) {
      return;
    }

    if (this.circuit.state === 'half-open') {
      this.tripCircuit();
      return;
    }

    if (status !== undefined && !this.isFailureStatus(status)) {
      return;
    }

    this.circuit.failureCount += 1;
    if (this.circuit.failureCount >= this.circuitBreakerOptions.failureThreshold) {
      this.tripCircuit();
    }
  }

  private recordSuccess(): void {
    if (!this.circuit) {
      return;
    }

    this.circuit.state = 'closed';
    this.circuit.failureCount = 0;
    this.circuit.nextAttemptAt = 0;
    this.circuit.halfOpenInFlight = 0;
  }

  private tripCircuit(): void {
    if (!this.circuit || !this.circuitBreakerOptions) {
      return;
    }

    this.circuit.state = 'open';
    this.circuit.failureCount = 0;
    this.circuit.halfOpenInFlight = 0;
    this.circuit.nextAttemptAt = Date.now() + this.circuitBreakerOptions.resetTimeoutMs;
  }

  private isFailureStatus(status: number): boolean {
    return status >= 500;
  }

  private async performRequest(
    input: RequestInfo | URL,
    init: OutboundRequestInit,
    timeoutMs?: number,
  ): Promise<Response> {
    const controller = new AbortController();

    if (init.signal) {
      if (init.signal.aborted) {
        controller.abort(init.signal.reason);
      } else {
        init.signal.addEventListener('abort', () => {
          controller.abort(init.signal.reason);
        });
      }
    }

    const { retry: _retry, timeoutMs: _timeoutOverride, ...fetchInit } = init;

    let timeoutId: NodeJS.Timeout | undefined;
    if (timeoutMs && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort(new RequestTimeoutError(timeoutMs));
      }, timeoutMs);
    }

    try {
      const response = await this.fetchImpl(input, {
        ...fetchInit,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const reason = (controller.signal as AbortSignal & { reason?: unknown }).reason;
        if (reason instanceof RequestTimeoutError) {
          throw reason;
        }
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
