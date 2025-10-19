import crypto from "node:crypto";
import { NormalizedEmployee, NormalizedEmployeeSchema, NormalizedInvoice, NormalizedInvoiceSchema, NormalizedPayment, NormalizedPaymentSchema, WebhookPayloadSchema } from "../schemas/connectors";
import { Connector, ListEntitiesParams, OAuthTokenSet, WebhookVerificationResult } from "./types";
import { verifyJwt } from "../utils/jwt";

function randomToken(provider: string, prefix: string) {
  return `${provider}_${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function baseInvoices(provider: string, orgId: string): NormalizedInvoice[] {
  return NormalizedInvoiceSchema.array().parse([
    {
      provider,
      orgId,
      externalId: `${provider}-${orgId}-inv-001`,
      number: "INV-001",
      status: "AUTHORISED",
      total: 1280.5,
      currency: "AUD",
      issuedAt: new Date("2024-01-15T00:00:00Z"),
      dueAt: new Date("2024-01-30T00:00:00Z"),
      customerName: "Example Customer Pty Ltd",
    },
  ]);
}

function basePayments(provider: string, orgId: string): NormalizedPayment[] {
  return NormalizedPaymentSchema.array().parse([
    {
      provider,
      orgId,
      externalId: `${provider}-${orgId}-pay-001`,
      amount: 1280.5,
      currency: "AUD",
      occurredAt: new Date("2024-01-20T10:00:00Z"),
      counterpartyName: "Example Customer Pty Ltd",
      description: "Invoice payment",
      type: "invoice_payment",
    },
  ]);
}

function baseEmployees(provider: string, orgId: string): NormalizedEmployee[] {
  return NormalizedEmployeeSchema.array().parse([
    {
      provider,
      orgId,
      externalId: `${provider}-${orgId}-emp-001`,
      fullName: "Sample Employee",
      email: "employee@example.com",
      status: "active",
      hiredAt: new Date("2023-07-01T00:00:00Z"),
    },
  ]);
}

interface BuildConnectorOptions {
  provider: string;
  oauthBaseUrl: string;
  webhookSecretEnv?: string;
  webhookType?: "hmac" | "jwt";
  hmacHeader?: string;
}

export function buildMockConnector(options: BuildConnectorOptions): Connector {
  const {
    provider,
    oauthBaseUrl,
    webhookSecretEnv,
    webhookType = "hmac",
    hmacHeader = "x-signature",
  } = options;

  async function ensureSecret(): Promise<string> {
    if (!webhookSecretEnv) {
      return "";
    }
    const value = process.env[webhookSecretEnv];
    if (!value) {
      throw new Error(`Missing ${webhookSecretEnv} secret`);
    }
    return value;
  }

  async function listWrapper<T>(params: ListEntitiesParams, factory: (provider: string, orgId: string) => T[]): Promise<T[]> {
    void params;
    switch (factory) {
      case baseInvoices:
        return baseInvoices(provider, params.orgId) as T[];
      case basePayments:
        return basePayments(provider, params.orgId) as T[];
      case baseEmployees:
        return baseEmployees(provider, params.orgId) as T[];
      default:
        return [];
    }
  }

  return {
    provider,
    authorizeURL({ orgId, state, redirectUri }) {
      const url = new URL(`${oauthBaseUrl}/${provider}/authorize`);
      url.searchParams.set("state", state);
      url.searchParams.set("orgId", orgId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "read accounting payroll");
      return url.toString();
    },
    async exchangeCode({ orgId }) {
      const now = Date.now();
      const tokens: OAuthTokenSet = {
        accessToken: randomToken(provider, "access"),
        refreshToken: randomToken(provider, "refresh"),
        expiresAt: new Date(now + 55 * 60 * 1000),
        scope: ["accounting", "payroll"],
      };
      void orgId;
      return tokens;
    },
    async refreshToken({ orgId }) {
      const now = Date.now();
      const tokens: OAuthTokenSet = {
        accessToken: randomToken(provider, "access"),
        refreshToken: randomToken(provider, "refresh"),
        expiresAt: new Date(now + 60 * 60 * 1000),
        scope: ["accounting", "payroll"],
      };
      void orgId;
      return tokens;
    },
    listInvoices(params) {
      return listWrapper(params, baseInvoices);
    },
    listPayments(params) {
      return listWrapper(params, basePayments);
    },
    listEmployees(params) {
      return listWrapper(params, baseEmployees);
    },
    async verifyWebhook(rawBody, headers): Promise<WebhookVerificationResult> {
      const lowerHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        if (Array.isArray(value)) {
          lowerHeaders[key.toLowerCase()] = value[0] ?? "";
        } else if (typeof value === "string") {
          lowerHeaders[key.toLowerCase()] = value;
        }
      }
      const payload = WebhookPayloadSchema.safeParse(JSON.parse(rawBody.toString("utf8") || "{}"));
      if (!payload.success) {
        return { valid: false, reason: "invalid_payload" };
      }
      const timestamp = payload.data.timestamp;
      const nonce = payload.data.nonce;
      const connectionId = payload.data.connectionId;
      if (!webhookSecretEnv) {
        return { valid: true, orgId: payload.data.orgId, connectionId, events: payload.data.events, nonce, timestamp };
      }
      const secret = await ensureSecret();
      if (webhookType === "jwt") {
        const authHeader = lowerHeaders["authorization"] ?? lowerHeaders["Authorization"];
        const token = authHeader?.replace(/^Bearer\s+/i, "");
        const verified = verifyJwt(token, secret);
        if (!verified) {
          return { valid: false, reason: "invalid_jwt" };
        }
        if (verified.nonce && verified.nonce !== nonce) {
          return { valid: false, reason: "nonce_mismatch" };
        }
        if (verified.orgId && verified.orgId !== payload.data.orgId) {
          return { valid: false, reason: "org_mismatch" };
        }
        return { valid: true, orgId: payload.data.orgId, connectionId: (verified.connectionId as string | undefined) ?? connectionId, events: payload.data.events, nonce, timestamp };
      }

      const signature = lowerHeaders[hmacHeader];
      if (!signature) {
        return { valid: false, reason: "missing_signature" };
      }
      const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
      const normalizedSignature = signature.trim();
      if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(normalizedSignature))) {
        return { valid: false, reason: "signature_mismatch" };
      }
      return { valid: true, orgId: payload.data.orgId, connectionId, events: payload.data.events, nonce, timestamp };
    },
  };
}
