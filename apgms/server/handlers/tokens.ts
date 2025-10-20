import { serverConfig } from "../config/index";
import { signRpt, type RptClaims, type SignedRpt } from "../../security/rpt";

export interface IssueRptInput {
  readonly subject: string;
  readonly scopes: readonly string[];
  readonly audience?: string;
  readonly context?: Record<string, unknown>;
  readonly expiresInSeconds?: number;
  readonly now?: number;
}

export interface IssuedRpt extends SignedRpt {
  readonly publicKey: string;
}

export function issueRptToken(input: IssueRptInput): IssuedRpt {
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  const payload: RptClaims = {
    sub: input.subject,
    scopes: [...input.scopes],
    aud: input.audience,
    context: input.context,
    iat: now,
    exp: input.expiresInSeconds ? now + input.expiresInSeconds : undefined,
  };

  const signed = signRpt(payload, { now: now * 1000 });

  return {
    ...signed,
    publicKey: serverConfig.security.rpt.publicKey,
  };
}
