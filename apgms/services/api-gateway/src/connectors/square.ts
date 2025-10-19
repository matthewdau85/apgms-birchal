import { buildMockConnector } from "./base";

const SquareConnector = buildMockConnector({
  provider: "square",
  oauthBaseUrl: "https://mock-oauth.example.com",
  webhookSecretEnv: "SQUARE_WEBHOOK_SECRET",
  webhookType: "hmac",
  hmacHeader: "x-square-signature",
});

export default SquareConnector;
