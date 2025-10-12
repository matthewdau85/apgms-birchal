import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

export interface RateLimitOptions {
  max: number;
  timeWindow: number;
  keyGenerator?: (request: FastifyRequest) => string;
}

export interface IdempotencyOptions {
  enabled?: boolean;
  header?: string;
  storageTtlMs?: number;
}

export interface SecurityPluginOptions {
  rateLimit?: RateLimitOptions;
  idempotency?: IdempotencyOptions;
}

interface RateState {
  count: number;
  resetAt: number;
}

interface IdempotentEntry {
  payload: string;
  statusCode: number;
  headers: Record<string, string>;
  expiresAt: number;
}

interface IdempotencyContext {
  key: string;
  ttl: number;
}

const defaultIdempotencyHeader = 'idempotency-key';
const defaultIdempotencyTtl = 86_400_000; // 24 hours
const retryAfterHeader = 'retry-after';
const idempotencyReplayHeader = 'idempotent-replay';
const IDEMPOTENCY_SYMBOL: unique symbol = Symbol('idempotency-context');

type RequestWithIdempotency = FastifyRequest & {
  [IDEMPOTENCY_SYMBOL]?: IdempotencyContext;
};

function rateLimitHook(options: RateLimitOptions) {
  const store = new Map<string, RateState>();

  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const key = options.keyGenerator ? options.keyGenerator(request) : request.ip;
    const now = Date.now();
    const windowMs = options.timeWindow;
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      reply.header(retryAfterHeader, Math.ceil(windowMs / 1000));
      done();
      return;
    }

    if (existing.count >= options.max) {
      void reply.status(429).send({ error: 'Too Many Requests' });
      return;
    }

    existing.count += 1;
    reply.header(retryAfterHeader, Math.ceil((existing.resetAt - now) / 1000));
    done();
  };
}

function normalizeHeaderName(value: string): string {
  return value.toLowerCase();
}

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const normalized = normalizeHeaderName(name);
  const value = request.headers[name] ?? request.headers[normalized];
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}

function idempotencyPreHandler(
  store: Map<string, IdempotentEntry>,
  options: Required<IdempotencyOptions>,
) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    if (!options.enabled) {
      done();
      return;
    }

    const key = getHeader(request, options.header);

    if (!key) {
      done();
      return;
    }

    const entry = store.get(key);
    const now = Date.now();

    if (entry && entry.expiresAt > now) {
      reply.header(idempotencyReplayHeader, 'true');
      for (const [headerKey, headerValue] of Object.entries(entry.headers)) {
        reply.header(headerKey, headerValue);
      }

      void reply.status(entry.statusCode).send(entry.payload);
      return;
    }

    (request as RequestWithIdempotency)[IDEMPOTENCY_SYMBOL] = {
      key,
      ttl: options.storageTtlMs ?? defaultIdempotencyTtl,
    };

    done();
  };
}

function idempotencyOnSend(store: Map<string, IdempotentEntry>) {
  return (request: FastifyRequest, reply: FastifyReply, payload: unknown, done: () => void) => {
    const context = (request as RequestWithIdempotency)[IDEMPOTENCY_SYMBOL];

    if (!context) {
      done();
      return;
    }

    let serialized: string;

    if (typeof payload === 'string') {
      serialized = payload;
    } else if (payload === undefined || payload === null) {
      serialized = '';
    } else if (payload instanceof Buffer) {
      serialized = payload.toString('utf8');
    } else {
      serialized = JSON.stringify(payload);
    }

    const headers: Record<string, string> = {};
    for (const [headerKey, headerValue] of Object.entries(reply.getHeaders())) {
      if (typeof headerValue === 'string') {
        headers[headerKey] = headerValue;
      }
    }

    store.set(context.key, {
      payload: serialized,
      statusCode: reply.statusCode,
      headers,
      expiresAt: Date.now() + context.ttl,
    });

    done();
  };
}

const securityPlugin: FastifyPluginAsync<SecurityPluginOptions> = async (instance, options) => {
  if (options.rateLimit) {
    instance.addHook('onRequest', rateLimitHook(options.rateLimit));
  }

  if (options.idempotency && options.idempotency.enabled) {
    const store = new Map<string, IdempotentEntry>();
    const resolved: Required<IdempotencyOptions> = {
      enabled: options.idempotency.enabled,
      header: options.idempotency.header ?? defaultIdempotencyHeader,
      storageTtlMs: options.idempotency.storageTtlMs ?? defaultIdempotencyTtl,
    };

    instance.addHook('preHandler', idempotencyPreHandler(store, resolved));
    instance.addHook('onSend', idempotencyOnSend(store));
  }
};

export const securityMiddleware = fp(securityPlugin, {
  name: 'shared-security-middleware',
});
