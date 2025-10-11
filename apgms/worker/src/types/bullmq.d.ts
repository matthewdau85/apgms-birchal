declare module 'bullmq' {
  export class Queue {
    constructor(name: string, options?: { connection?: Record<string, unknown> });
    add(name: string, data: unknown): Promise<{ id?: string | number }>;
    close(): Promise<void>;
  }

  export class Worker {
    constructor(
      name: string,
      processor: (job: {
        id?: string | number;
        name?: string;
        data: unknown;
        attemptsMade?: number;
      }) => Promise<void> | void,
      options?: { connection?: Record<string, unknown> },
    );
    close(): Promise<void>;
    on(event: 'error', handler: (error: unknown) => void): void;
  }
}
