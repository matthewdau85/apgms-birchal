export interface JobDescriptor {
  id: string;
  attempts: number;
}

export function nextBackoffMs({ attempts }: JobDescriptor): number {
  const cappedAttempts = Math.max(0, Math.min(attempts, 10));
  const base = 2 ** cappedAttempts * 100;
  return Math.min(base, 60_000);
}
