export const CONNECTOR_SOURCES = {
  PAYROLL: "PAYROLL",
  POS: "POS",
} as const;

export type ConnectorSource = (typeof CONNECTOR_SOURCES)[keyof typeof CONNECTOR_SOURCES];
