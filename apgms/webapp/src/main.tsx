import { attachIntegrationHandlers, defaultTiles } from "./routes/integrations";
import { openOAuthWindow } from "./lib/oauth";

declare const document: Document | undefined;

timeoutFallback();

function timeoutFallback() {
  // placeholder to ensure module executes in non-browser tests
}

if (typeof document !== "undefined") {
  const root = document.getElementById("app");
  if (root) {
    attachIntegrationHandlers(root, {
      tiles: defaultTiles(),
      onConnect: async (provider) => {
        try {
          await openOAuthWindow({ provider, url: `/connect/${provider}/start` });
        } catch (err) {
          console.error("oauth_start_failed", err);
        }
      },
      onDisconnect: (provider) => {
        console.log("disconnect", provider);
      },
    });
  }
}
