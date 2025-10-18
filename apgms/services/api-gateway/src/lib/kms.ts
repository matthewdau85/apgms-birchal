import { createSign, createVerify, generateKeyPairSync, KeyObject } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface SignerProvider {
  readonly keyId?: string;
  readonly region?: string;
  sign(payload: Uint8Array): Promise<Uint8Array>;
  verify(payload: Uint8Array, signature: Uint8Array): Promise<boolean>;
}

export class DevMemorySigner implements SignerProvider {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicExponent: 0x10001,
    });
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    const signer = createSign("RSA-SHA256");
    signer.update(payload);
    signer.end();
    const signature = signer.sign(this.privateKey);
    return new Uint8Array(signature);
  }

  async verify(payload: Uint8Array, signature: Uint8Array): Promise<boolean> {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(payload);
    verifier.end();
    return verifier.verify(this.publicKey, Buffer.from(signature));
  }
}

export type KmsLikeClient = {
  send(command: unknown): Promise<any>;
};

type SignCommandInput = {
  KeyId: string;
  Message: Uint8Array;
  SigningAlgorithm: string;
  MessageType?: string;
};

type VerifyCommandInput = {
  KeyId: string;
  Message: Uint8Array;
  Signature: Uint8Array;
  SigningAlgorithm: string;
  MessageType?: string;
};

type SignCommandConstructor = new (input: SignCommandInput) => { input: SignCommandInput };
type VerifyCommandConstructor = new (input: VerifyCommandInput) => { input: VerifyCommandInput };

export interface AwsKmsSignerOptions {
  keyId: string;
  region: string;
  client?: KmsLikeClient;
  signCommand?: SignCommandConstructor;
  verifyCommand?: VerifyCommandConstructor;
  signingAlgorithm?:
    | "RSASSA_PSS_SHA_256"
    | "RSASSA_PSS_SHA_384"
    | "RSASSA_PSS_SHA_512"
    | "RSASSA_PKCS1_V1_5_SHA_256"
    | "RSASSA_PKCS1_V1_5_SHA_384"
    | "RSASSA_PKCS1_V1_5_SHA_512";
}

export class AwsKmsSigner implements SignerProvider {
  private client?: KmsLikeClient;
  private signCommandCtor?: SignCommandConstructor;
  private verifyCommandCtor?: VerifyCommandConstructor;
  private readonly initializePromise: Promise<void>;

  readonly keyId: string;
  readonly region: string;
  private readonly signingAlgorithm: NonNullable<AwsKmsSignerOptions["signingAlgorithm"]>;

  constructor(options: AwsKmsSignerOptions) {
    this.keyId = options.keyId;
    this.region = options.region;
    this.signingAlgorithm = options.signingAlgorithm ?? "RSASSA_PSS_SHA_256";
    this.client = options.client;
    this.signCommandCtor = options.signCommand;
    this.verifyCommandCtor = options.verifyCommand;
    this.initializePromise = this.ensureAwsSdkLoaded();
  }

  private async ensureAwsSdkLoaded(): Promise<void> {
    if (this.client && this.signCommandCtor && this.verifyCommandCtor) {
      return;
    }

    try {
      const mod = await import("@aws-sdk/client-kms");
      this.client = this.client ?? new mod.KMSClient({ region: this.region });
      this.signCommandCtor = this.signCommandCtor ?? mod.SignCommand;
      this.verifyCommandCtor = this.verifyCommandCtor ?? mod.VerifyCommand;
    } catch (error) {
      throw new Error(
        "Failed to load @aws-sdk/client-kms. Ensure the dependency is installed when using the KMS signer.",
      );
    }
  }

  private async ready(): Promise<void> {
    await this.initializePromise;
    if (!this.client || !this.signCommandCtor || !this.verifyCommandCtor) {
      throw new Error("AWS KMS signer was not initialized correctly");
    }
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    await this.ready();
    const SignCommand = this.signCommandCtor!;
    const command = new SignCommand({
      KeyId: this.keyId,
      Message: payload,
      SigningAlgorithm: this.signingAlgorithm,
      MessageType: "RAW",
    });

    const response = await this.client!.send(command);
    if (!response || !response.Signature) {
      throw new Error("KMS did not return a signature");
    }

    return new Uint8Array(response.Signature);
  }

  async verify(payload: Uint8Array, signature: Uint8Array): Promise<boolean> {
    await this.ready();
    const VerifyCommand = this.verifyCommandCtor!;
    const command = new VerifyCommand({
      KeyId: this.keyId,
      Message: payload,
      Signature: signature,
      SigningAlgorithm: this.signingAlgorithm,
      MessageType: "RAW",
    });

    const response = await this.client!.send(command);
    return Boolean(response?.SignatureValid);
  }
}

export interface SignerProviderFactoryOptions {
  evidenceRoot?: string;
  kmsClient?: KmsLikeClient;
  signCommand?: SignCommandConstructor;
  verifyCommand?: VerifyCommandConstructor;
  now?: () => Date;
}

let defaultProviderPromise: Promise<SignerProvider> | undefined;

export function getSignerProviderFromEnv(
  options: SignerProviderFactoryOptions = {},
): Promise<SignerProvider> {
  const hasOverrides = Boolean(
    options.evidenceRoot || options.kmsClient || options.signCommand || options.verifyCommand || options.now,
  );
  if (!hasOverrides) {
    if (!defaultProviderPromise) {
      defaultProviderPromise = createSignerProviderFromEnv({});
    }
    return defaultProviderPromise;
  }

  return createSignerProviderFromEnv(options);
}

async function createSignerProviderFromEnv(
  options: SignerProviderFactoryOptions,
): Promise<SignerProvider> {
  const provider = (process.env.SIGNER_PROVIDER ?? "dev").toLowerCase();

  if (provider === "kms") {
    const keyId = process.env.KMS_KEY_ID;
    const region = process.env.AWS_REGION;
    if (!keyId) {
      throw new Error("KMS_KEY_ID must be set when SIGNER_PROVIDER=kms");
    }
    if (!region) {
      throw new Error("AWS_REGION must be set when SIGNER_PROVIDER=kms");
    }

    const signer = new AwsKmsSigner({
      keyId,
      region,
      client: options.kmsClient,
      signCommand: options.signCommand,
      verifyCommand: options.verifyCommand,
    });

    await writeEvidence({
      provider: "kms",
      keyId,
      region,
      now: options.now,
      evidenceRoot: options.evidenceRoot,
    });

    return signer;
  }

  return new DevMemorySigner();
}

interface EvidenceOptions {
  provider: string;
  keyId: string;
  region: string;
  now?: () => Date;
  evidenceRoot?: string;
}

async function writeEvidence(options: EvidenceOptions): Promise<void> {
  const { provider, keyId, region } = options;
  const evidenceRoot =
    options.evidenceRoot ?? process.env.EVIDENCE_ROOT ?? path.resolve(process.cwd(), "evidence");
  const filePath = path.join(evidenceRoot, "keys", "provider.json");
  const payload = {
    provider,
    keyId,
    region,
    ts: (options.now ? options.now() : new Date()).toISOString(),
  };

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}
