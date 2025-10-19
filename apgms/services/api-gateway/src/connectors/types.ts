import { NormalizedEmployee, NormalizedInvoice, NormalizedPayment, WebhookEvent } from "../schemas/connectors";

export interface AuthorizeURLParams {
  orgId: string;
  state: string;
  redirectUri: string;
}

export interface ExchangeCodeParams {
  orgId: string;
  code: string;
  redirectUri: string;
}

export interface RefreshTokenParams {
  orgId: string;
  refreshToken: string;
}

export interface ListEntitiesParams {
  orgId: string;
  accessToken: string;
  cursor?: string | null;
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string[];
}

export interface WebhookVerificationResult {
  valid: boolean;
  orgId?: string;
  connectionId?: string;
  events?: WebhookEvent[];
  nonce?: string;
  timestamp?: Date;
  reason?: string;
}

export interface Connector {
  readonly provider: string;
  authorizeURL(params: AuthorizeURLParams): Promise<string> | string;
  exchangeCode(params: ExchangeCodeParams): Promise<OAuthTokenSet>;
  refreshToken(params: RefreshTokenParams): Promise<OAuthTokenSet>;
  listInvoices(params: ListEntitiesParams): Promise<NormalizedInvoice[]>;
  listPayments(params: ListEntitiesParams): Promise<NormalizedPayment[]>;
  listEmployees(params: ListEntitiesParams): Promise<NormalizedEmployee[]>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<WebhookVerificationResult>;
}

export type ConnectorRegistry = Record<string, Connector>;
