import { buildMockConnector } from "./base";

const QuickBooksConnector = buildMockConnector({
  provider: "qbo",
  oauthBaseUrl: "https://mock-oauth.example.com",
  webhookSecretEnv: "QBO_WEBHOOK_SECRET",
  webhookType: "hmac",
  hmacHeader: "x-intuit-signature",
});

export default QuickBooksConnector;
