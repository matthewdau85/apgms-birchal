export interface HealthStatus {
  ok: true;
  service: string;
  uptimeSeconds: number;
  checkedAt: number;
}

export const getHealthStatus = (service: string, now: () => number = () => Date.now()): HealthStatus => {
  if (!service) {
    throw new Error("service name is required");
  }
  const checkedAt = now();
  if (!Number.isFinite(checkedAt)) {
    throw new Error("invalid clock");
  }
  return {
    ok: true,
    service,
    uptimeSeconds: Math.floor(process.uptime()),
    checkedAt,
  };
};
