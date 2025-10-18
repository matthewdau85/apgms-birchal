import crypto from "node:crypto";

export interface ReplayResult {
  ok: boolean;
  reason?: string;
}

export interface ReplayState {
  seenAt: number;
}

export class ReplayProtector {
  private readonly seen = new Map<string, ReplayState>();
  private readonly windowMs: number;

  constructor(windowMs = 5 * 60 * 1000) {
    this.windowMs = windowMs;
  }

  check(eventId: string, timestamp: number): ReplayResult {
    const now = Date.now();
    this.gc(now);

    if (timestamp < now - this.windowMs) {
      return { ok: false, reason: "event_too_old" };
    }

    const state = this.seen.get(eventId);
    if (state) {
      return { ok: false, reason: "replay_detected" };
    }

    this.seen.set(eventId, { seenAt: now });
    return { ok: true };
  }

  private gc(now: number) {
    for (const [eventId, state] of this.seen.entries()) {
      if (state.seenAt < now - this.windowMs) {
        this.seen.delete(eventId);
      }
    }
  }
}

export function createSignature(payload: unknown, secret: string): string {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function verifySignature(payload: unknown, secret: string, signature?: string | string[]): boolean {
  if (!signature) return false;
  const provided = Array.isArray(signature) ? signature[0] : signature;
  if (!provided) return false;
  const expected = createSignature(payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
