import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

function parseAllowlist(v?: string): string[] {
  if (!v || !v.trim()) return ['http://localhost:3000'];
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

export const corsAllowlistPlugin: FastifyPluginAsync = fp(async (app) => {
  const allowlist = parseAllowlist(process.env.CORS_ALLOWLIST);
  const wildcard = allowlist.includes('*');

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (wildcard) return cb(null, true);
      const ok = allowlist.includes(origin);
      cb(ok ? null : new Error('CORS_ORIGIN_NOT_ALLOWED'), ok);
    },
    credentials: true,
    methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Idempotency-Key','X-Request-Id'],
    exposedHeaders: ['X-Request-Id','Idempotent-Replay'],
    maxAge: 86400
  });
});

export default corsAllowlistPlugin;
