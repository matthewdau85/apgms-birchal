import { SignerProvider, getSignerProviderFromEnv } from "./kms";

export interface RptToken<T = Record<string, unknown>> {
  payload: T;
  signature: string;
}

export async function signRpt<T = Record<string, unknown>>(
  payload: T,
  provider?: SignerProvider,
): Promise<RptToken<T>> {
  const signer = provider ?? (await getSignerProviderFromEnv());
  const message = serializePayload(payload);
  const signature = await signer.sign(message);

  return {
    payload,
    signature: Buffer.from(signature).toString("base64"),
  };
}

export async function verifyRpt<T = Record<string, unknown>>(
  token: RptToken<T>,
  provider?: SignerProvider,
): Promise<boolean> {
  const signer = provider ?? (await getSignerProviderFromEnv());
  const message = serializePayload(token.payload);
  const signature = Buffer.from(token.signature, "base64");
  return signer.verify(message, signature);
}

function serializePayload(payload: unknown): Uint8Array {
  const canonical = canonicalize(payload);
  return new Uint8Array(Buffer.from(JSON.stringify(canonical)));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}
