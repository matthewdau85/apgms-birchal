import { buildMockConnector } from "./base";

const MyobConnector = buildMockConnector({
  provider: "myob",
  oauthBaseUrl: "https://mock-oauth.example.com",
  webhookSecretEnv: "MYOB_WEBHOOK_SECRET",
  webhookType: "hmac",
  hmacHeader: "x-myob-signature",
});

export default MyobConnector;
