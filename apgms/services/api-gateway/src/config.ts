import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().default(3000),
  ALLOWED_ORIGINS: z.string().default(""),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
});

export const config = Env.parse(process.env);
