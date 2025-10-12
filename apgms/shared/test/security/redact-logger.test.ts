import { describe, expect, it } from 'vitest';
import { createRedactingLogger, PinoChildOptions, PinoLikeLogger } from '../../src/security/redact-logger';

class FakeLogger implements PinoLikeLogger {
  constructor(private readonly sink: (args: unknown[]) => void, private readonly options?: PinoChildOptions) {}

  child(_bindings: Record<string, unknown> = {}, options?: PinoChildOptions): PinoLikeLogger {
    const merged: PinoChildOptions = {
      ...this.options,
      ...options,
      hooks: options?.hooks ?? this.options?.hooks,
      redact: options?.redact ?? this.options?.redact,
    };

    return new FakeLogger(this.sink, merged);
  }

  info(...args: unknown[]): void {
    this.log('info', ...args);
  }

  private log(level: string, ...args: unknown[]) {
    const invoke = (...processed: unknown[]) => {
      this.sink([level, ...processed]);
    };

    if (this.options?.hooks?.logMethod) {
      this.options.hooks.logMethod(args, invoke);
    } else {
      invoke(...args);
    }
  }
}

describe('redacting logger', () => {
  it('redacts sensitive fields and configured paths', () => {
    const entries: unknown[][] = [];
    const base = new FakeLogger((payload) => entries.push(payload));
    const logger = createRedactingLogger(base, { paths: ['metadata.clientId'] });

    logger.info(
      {
        tfn: '123456782',
        abn: '51824753556',
        pan: '4111 1111 1111 1111',
        password: 'super-secret',
        metadata: {
          apiKey: 'abc123',
          clientId: 'client-001',
        },
        notes: ['card 4444 3333 2222 1111'],
      },
      'Customer TFN 987654321',
    );

    expect(entries).toHaveLength(1);
    const [, payload, message] = entries[0];
    const record = payload as Record<string, unknown>;

    expect(record.tfn).toBe('[REDACTED]');
    expect(record.abn).toBe('[REDACTED]');
    expect(record.pan).toBe('[REDACTED]');
    expect(record.password).toBe('[REDACTED]');
    expect((record.metadata as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((record.metadata as Record<string, unknown>).clientId).toBe('[REDACTED]');
    expect((record.notes as string[])[0]).not.toContain('4444');
    expect(typeof message).toBe('string');
    expect((message as string)).not.toContain('987654321');
  });
});
