import { z } from "zod";

const booleanFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return /^(true|1|yes)$/i.test(value);
};

const configSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  sbr: z.object({
    endpoint: z.string().url(),
    username: z.string().min(1),
    password: z.string().min(1),
    fromPartyId: z.string().min(1),
    toPartyId: z.string().min(1),
    service: z.string().min(1),
    action: z.string().min(1),
    replyTo: z.string().url().optional(),
    mockResponses: z.boolean(),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;
export type SbrConfig = AppConfig["sbr"];

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const nodeEnv = env.NODE_ENV ?? "development";
  const isDevLike = nodeEnv === "development" || nodeEnv === "test";

  const resolved = configSchema.parse({
    nodeEnv,
    sbr: {
      endpoint: env.SBR_ENDPOINT ?? (isDevLike ? "https://sandbox.sbr.gov.au/as4" : undefined),
      username: env.SBR_USERNAME ?? (isDevLike ? "dev-user" : undefined),
      password: env.SBR_PASSWORD ?? (isDevLike ? "dev-password" : undefined),
      fromPartyId: env.SBR_FROM_PARTY_ID ?? (isDevLike ? "DEV-FROM" : undefined),
      toPartyId: env.SBR_TO_PARTY_ID ?? (isDevLike ? "DEV-TO" : undefined),
      service: env.SBR_SERVICE ?? "SubmitDocument",
      action: env.SBR_ACTION ?? "Submit",
      replyTo: env.SBR_REPLY_TO,
      mockResponses: booleanFromEnv(env.SBR_MOCK_RESPONSES, isDevLike),
    },
  });

  return resolved;
};

export const config = loadConfig();
