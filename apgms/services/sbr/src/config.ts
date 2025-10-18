import { z } from "zod";
import type { AuthCredentials } from "./clients";

const envSchema = z.object({
  SBR_ENDPOINT: z.string().url(),
  SBR_PRODUCT_ID: z.string().min(1),
  SBR_AUTH_MODE: z.enum(["auskey", "mygovid"]).default("mygovid"),
  SBR_ABN: z.string().min(11),
  SBR_SERIAL_NUMBER: z.string().optional(),
  SBR_KEYSTORE_ID: z.string().optional(),
  SBR_DEVICE_ID: z.string().optional(),
  SBR_AUTH_TOKEN: z.string().optional(),
});

export interface SbrConfig {
  endpoint: string;
  productId: string;
  credentials: AuthCredentials;
}

export function loadConfig(env = process.env): SbrConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid SBR configuration: ${parsed.error.message}`);
  }

  const data = parsed.data;

  if (data.SBR_AUTH_MODE === "auskey") {
    if (!data.SBR_SERIAL_NUMBER || !data.SBR_KEYSTORE_ID) {
      throw new Error("AUSkey mode requires SBR_SERIAL_NUMBER and SBR_KEYSTORE_ID");
    }
    return {
      endpoint: data.SBR_ENDPOINT,
      productId: data.SBR_PRODUCT_ID,
      credentials: {
        type: "auskey",
        abn: data.SBR_ABN,
        serialNumber: data.SBR_SERIAL_NUMBER,
        keystoreId: data.SBR_KEYSTORE_ID,
      },
    };
  }

  if (!data.SBR_DEVICE_ID || !data.SBR_AUTH_TOKEN) {
    throw new Error("MyGovID mode requires SBR_DEVICE_ID and SBR_AUTH_TOKEN");
  }

  return {
    endpoint: data.SBR_ENDPOINT,
    productId: data.SBR_PRODUCT_ID,
    credentials: {
      type: "mygovid",
      abn: data.SBR_ABN,
      deviceId: data.SBR_DEVICE_ID,
      authToken: data.SBR_AUTH_TOKEN,
    },
  };
}
