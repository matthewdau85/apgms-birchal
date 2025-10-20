export function createHealthResponse() {
  return { ok: true, service: "api-gateway" } as const;
}
