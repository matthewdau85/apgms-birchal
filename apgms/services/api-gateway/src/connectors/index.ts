import XeroConnector from "./xero";
import QuickBooksConnector from "./qbo";
import MyobConnector from "./myob";
import SquareConnector from "./square";
import ShopifyConnector from "./shopify";
import { ConnectorRegistry } from "./types";

export const connectors: ConnectorRegistry = {
  xero: XeroConnector,
  qbo: QuickBooksConnector,
  myob: MyobConnector,
  square: SquareConnector,
  shopify: ShopifyConnector,
};

export function getConnector(provider: string) {
  return connectors[provider];
}

export type ProviderName = keyof typeof connectors;
