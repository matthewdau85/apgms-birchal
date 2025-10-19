import fp from 'fastify-plugin';
import { FastifyReply, FastifyRequest, FastifyPluginAsync } from 'fastify';
import { createHash } from 'crypto';

type CachedEntry = {
  statusCode: number;
  headers: Record<string, string>;
  payload: string; // JSON stringified
};

type Store = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

const inMemory = new Map<string, { value: string; expiresAt: number }>();

async function getInMemory(key: string): Promise<string | null> {
  const rec = inMemory.get(key);
  if (!rec) return null;
  if (Date.now() > rec.expiresAt) { inMemory.delete(key); return null; }
  return rec.value;
}
async function setInMemory(key: string, value: string, ttlSeconds: number): Promise<void> {
  inMemory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function normalizeHeaders(h: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h || {})) {
    if (v == null) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

function computeDeterministicKey(req: FastifyRequest, orgId: string | undefined): string {
  const method = (req.method || 'GET').toUpperCase();
  const url = req.url || '';
  const body = typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body ?? '');
  const idemHeader = (req.headers['idempotency-key'] as string | undefined) || '';
  const base = JSON.stringify({ method, url, body, orgId, idemHeader });
  return createHash('sha256').update(base).digest('hex');
}

export interface IdempotencyOptions {
  ttlSeconds?: number;         // cache TTL, default 3600
  headerName?: string;         // request header to respect, default 'idempotency-key'
  methods?: Array<'POST' | 'PUT' | 'PATCH' | 'DELETE'>; // which methods are idempotent
}

declare module 'fastify' {
  interface FastifyInstance {
    idempotency: IdempotencyOptions;
  }
}

const idempotencyPlugin: FastifyPluginAsync<IdempotencyOptions> = fp(async (app, opts) => {
  const ttl = opts.ttlSeconds ?? 3600;
  const headerName = (opts.headerName || 'idempotency-key').toLowerCase();
  const methods = new Set((opts.methods ?? ['POST', 'PUT', 'PATCH', 'DELETE']).map(m => m.toUpperCase()));

  // Prefer Redis if available as app.redis, else fallback to in-memory
  const store: Store = (app as any).redis && typeof (app as any).redis.get === 'function'
    ? {
        get: async (k) => (app as any).redis.get(k),
        set: async (k, v, t) => { await (app as any).redis.set(k, v, 'EX', t); }
      }
    : {
        get: getInMemory,
        set: setInMemory
      };

  app.decorate('idempotency', { ttlSeconds: ttl, headerName, methods });

  app.addHook('preHandler', async (req, reply) => {
    if (!methods.has((req.method || '').toUpperCase())) return;

    // @ts-ignore populated by auth/org-scope if present
    const orgId: string | undefined = (req as any).orgId;
    const key = computeDeterministicKey(req, orgId);

    const cached = await store.get(`idem:${key}`);
    if (cached) {
      try {
        const entry: CachedEntry = JSON.parse(cached);
        reply.header('Idempotent-Replay', 'true');
        for (const [hk, hv] of Object.entries(entry.headers || {})) {
          if (hk === 'content-length') continue;
          reply.header(hk, hv);
        }
        reply.code(entry.statusCode).send(entry.payload ? JSON.parse(entry.payload) : null);
        return;
      } catch {
        // if corrupt, ignore and let request continue
      }
    }

    // wrap reply.send to capture result
    const originalSend = reply.send.bind(reply);
    reply.send = (payload?: any) => {
      // only cache JSON responses
      let bodyStr = '';
      try {
        bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
      } catch {
        bodyStr = '';
      }

      const statusCode = reply.statusCode || 200;
      const headers = normalizeHeaders(reply.getHeaders() as any);

      const entry: CachedEntry = { statusCode, headers, payload: bodyStr };
      // no await; fire-and-forget
      store.set(`idem:${key}`, JSON.stringify(entry), ttl).catch(() => {});

      return originalSend(payload);
    };
  });
});

export default idempotencyPlugin;
