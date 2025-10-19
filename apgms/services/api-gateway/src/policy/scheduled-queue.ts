import { Clock, RemittanceRequest, ScheduledRemittance } from "./types";

export interface QueueEntry extends ScheduledRemittance {}

export class ScheduledQueue {
  private readonly queue: QueueEntry[] = [];

  constructor(private readonly clock: Clock = () => new Date()) {}

  enqueue(input: {
    remittanceId: string;
    gateId: string;
    payload: RemittanceRequest;
    opensAt: Date;
  }): QueueEntry {
    const scheduled: QueueEntry = {
      remittanceId: input.remittanceId,
      gateId: input.gateId,
      payload: input.payload,
      opensAt: input.opensAt,
      scheduledAt: this.clock(),
    };
    this.queue.push(scheduled);
    return { ...scheduled, payload: { ...scheduled.payload } };
  }

  all(): QueueEntry[] {
    return this.queue.map((item) => ({ ...item, payload: { ...item.payload } }));
  }

  count(): number {
    return this.queue.length;
  }
}
