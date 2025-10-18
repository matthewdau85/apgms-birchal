import type { ConnectorSource } from "./connectors.js";

export interface TaxEngineEvent {
  id: string;
  source: ConnectorSource;
  type: string;
  payload: unknown;
  receivedAt: Date;
}

export type TaxEngineEventHandler = (event: TaxEngineEvent) => void;

export interface TaxEventQueue {
  publish(event: TaxEngineEvent): void;
  subscribe(handler: TaxEngineEventHandler): () => void;
}

export class InMemoryTaxEventQueue implements TaxEventQueue {
  private subscribers = new Set<TaxEngineEventHandler>();
  private events: TaxEngineEvent[] = [];

  publish(event: TaxEngineEvent): void {
    this.events.push(event);
    for (const handler of this.subscribers) {
      handler(event);
    }
  }

  subscribe(handler: TaxEngineEventHandler): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  getEvents(): TaxEngineEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

export const taxEventQueue = new InMemoryTaxEventQueue();
