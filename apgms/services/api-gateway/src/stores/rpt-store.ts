import type { RptToken } from "../lib/dev-kms";

export const rptStore = new Map<string, RptToken>();

export const saveRpt = (token: RptToken) => {
  rptStore.set(token.id, token);
  return token;
};

export const findRpt = (id: string) => rptStore.get(id);
