import { buildMockConnector } from "./base";

const ShopifyConnector = buildMockConnector({
  provider: "shopify",
  oauthBaseUrl: "https://mock-oauth.example.com",
  webhookSecretEnv: "SHOPIFY_WEBHOOK_SECRET",
  webhookType: "hmac",
  hmacHeader: "x-shopify-hmac-sha256",
});

export default ShopifyConnector;
