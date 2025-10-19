import { buildMockConnector } from "./base";

const XeroConnector = buildMockConnector({
  provider: "xero",
  oauthBaseUrl: "https://mock-oauth.example.com",
  webhookSecretEnv: "XERO_WEBHOOK_SECRET",
  webhookType: "jwt",
});

export default XeroConnector;
