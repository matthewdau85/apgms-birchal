export type AuskeyCredentials = {
  type: "auskey";
  abn: string;
  serialNumber: string;
  keystoreId: string;
};

export type MyGovIdCredentials = {
  type: "mygovid";
  abn: string;
  deviceId: string;
  authToken: string;
};

export type AuthCredentials = AuskeyCredentials | MyGovIdCredentials;

export interface SoapRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface SoapResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type SoapTransport = (request: SoapRequest) => Promise<SoapResponse>;

export interface SoapClientOptions {
  endpoint: string;
  productId: string;
  credentials: AuthCredentials;
  transport?: SoapTransport;
  userAgent?: string;
}

export interface SoapFault {
  code: string;
  message: string;
  detail?: unknown;
}
