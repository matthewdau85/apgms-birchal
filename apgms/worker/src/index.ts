export function scheduleWindow(start: Date, durationMinutes: number): { start: Date; end: Date } {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("durationMinutes must be a positive number");
  }

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

if (import.meta.url === process.argv[1] || process.argv[1]?.endsWith("index.ts")) {
  const now = new Date();
  const window = scheduleWindow(now, 15);
  console.log(`Scheduled worker window from ${window.start.toISOString()} to ${window.end.toISOString()}`);
}
