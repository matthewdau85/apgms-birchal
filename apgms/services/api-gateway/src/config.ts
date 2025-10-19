import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['production','development','test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars (use 256-bit hex)'),
  JWT_ISSUER: z.string().default('apgms'),
  JWT_AUDIENCE: z.string().default('apgms-clients'),
  CORS_ALLOWLIST: z.string().default('http://localhost:3000'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  REDIS_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REQUEST_ID_HEADER: z.string().default('x-request-id'),
});

export type AppConfig = z.infer<typeof EnvSchema>;
let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const errs = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${errs}`);
  }
  cached = parsed.data;
  return cached!;
}

const config = loadConfig();
export default config;
