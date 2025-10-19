import { z } from "zod";

type AuthConfig =
  | {
      type: "secret";
      verifyKey: string;
    }
  | {
      type: "public";
      verifyKey: string;
      privateKey?: string;
    };

const envSchema = z.object({
  JWT_SECRET: z.string().min(1, "JWT_SECRET cannot be empty").optional(),
  JWT_PUBLIC_KEY: z.string().min(1, "JWT_PUBLIC_KEY cannot be empty").optional(),
  JWT_PRIVATE_KEY: z.string().min(1, "JWT_PRIVATE_KEY cannot be empty").optional(),
});

let cachedConfig: AuthConfig | null = null;

const normalizeKey = (value: string) => value.replace(/\\n/g, "\n");

export const getAuthConfig = (): AuthConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = envSchema.parse(process.env);

  if (env.JWT_PUBLIC_KEY) {
    cachedConfig = {
      type: "public",
      verifyKey: normalizeKey(env.JWT_PUBLIC_KEY),
      privateKey: env.JWT_PRIVATE_KEY ? normalizeKey(env.JWT_PRIVATE_KEY) : undefined,
    };
    return cachedConfig;
  }

  if (env.JWT_SECRET) {
    cachedConfig = { type: "secret", verifyKey: env.JWT_SECRET };
    return cachedConfig;
  }

  throw new Error("Missing JWT configuration: set JWT_SECRET or JWT_PUBLIC_KEY");
};

export type { AuthConfig };
