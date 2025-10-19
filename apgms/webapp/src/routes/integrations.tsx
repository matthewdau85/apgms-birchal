export type IntegrationStatus = "connected" | "disconnected" | "pending" | "error";

export interface IntegrationTileModel {
  provider: string;
  title: string;
  status: IntegrationStatus;
  lastSyncedAt?: string | null;
  error?: string | null;
}

export interface IntegrationsPageOptions {
  tiles: IntegrationTileModel[];
  onConnect?: (provider: string) => void;
  onDisconnect?: (provider: string) => void;
}

function formatStatus(tile: IntegrationTileModel) {
  switch (tile.status) {
    case "connected":
      return tile.lastSyncedAt ? `Connected · Last sync ${tile.lastSyncedAt}` : "Connected";
    case "pending":
      return "Connecting…";
    case "error":
      return tile.error ? `Error · ${tile.error}` : "Error";
    default:
      return "Not connected";
  }
}

export function renderIntegrationsPage(options: IntegrationsPageOptions): string {
  const { tiles } = options;
  const items = tiles
    .map((tile) => {
      const status = formatStatus(tile);
      const actionLabel = tile.status === "connected" ? "Disconnect" : "Connect";
      const action = tile.status === "connected" ? "disconnect" : "connect";
      return `
        <article class="integration-tile" data-provider="${tile.provider}">
          <header>
            <h3>${tile.title}</h3>
          </header>
          <p class="status">${status}</p>
          <button data-action="${action}" data-provider="${tile.provider}">${actionLabel}</button>
        </article>
      `;
    })
    .join("\n");
  return `<section class="integrations-grid">${items}</section>`;
}

export function attachIntegrationHandlers(root: HTMLElement, options: IntegrationsPageOptions) {
  root.innerHTML = renderIntegrationsPage(options);
  root.querySelectorAll<HTMLButtonElement>("button[data-provider]").forEach((button) => {
    const provider = button.dataset.provider!;
    button.addEventListener("click", () => {
      if (button.dataset.action === "connect") {
        options.onConnect?.(provider);
      } else {
        options.onDisconnect?.(provider);
      }
    });
  });
}

export function defaultTiles(): IntegrationTileModel[] {
  return [
    { provider: "xero", title: "Xero", status: "disconnected" },
    { provider: "qbo", title: "QuickBooks Online", status: "disconnected" },
    { provider: "myob", title: "MYOB", status: "disconnected" },
    { provider: "square", title: "Square", status: "disconnected" },
    { provider: "shopify", title: "Shopify", status: "disconnected" },
  ];
}
