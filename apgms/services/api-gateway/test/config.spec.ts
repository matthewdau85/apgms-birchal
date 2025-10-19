import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config';

describe('config validation', () => {
  it('accepts valid env', () => {
    const cfg = loadConfig({
      NODE_ENV: 'test',
      PORT: '8080',
      LOG_LEVEL: 'info',
      JWT_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      JWT_ISSUER: 'apgms',
      JWT_AUDIENCE: 'apgms-clients',
      CORS_ALLOWLIST: 'http://localhost:3000',
      RATE_LIMIT_MAX: '100',
      RATE_LIMIT_WINDOW: '1 minute',
      REQUEST_ID_HEADER: 'x-request-id',
    } as any);
    expect(cfg.PORT).toBe(8080);
    expect(cfg.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('rejects missing/weak JWT_SECRET', () => {
    expect(() => loadConfig({
      NODE_ENV: 'test',
      PORT: '8080',
      LOG_LEVEL: 'info',
      JWT_ISSUER: 'apgms',
      JWT_AUDIENCE: 'apgms-clients',
      CORS_ALLOWLIST: 'http://localhost:3000',
      RATE_LIMIT_MAX: '100',
      RATE_LIMIT_WINDOW: '1 minute',
    } as any)).toThrow(/JWT_SECRET/);
  });
});
