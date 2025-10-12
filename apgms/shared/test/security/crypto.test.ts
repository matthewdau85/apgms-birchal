import { describe, expect, it, vi } from 'vitest';

vi.mock('argon2', () => ({
  default: {
    argon2id: 2,
    async hash(plain: string) {
      return `hashed:${plain}`;
    },
    async verify(hash: string, plain: string) {
      return hash === `hashed:${plain}`;
    },
  },
  argon2id: 2,
}), { virtual: true });

import { hashPassword, verifyPassword } from '../../src/security/crypto';

const options = {
  memoryCost: 2 ** 12,
  timeCost: 2,
  parallelism: 1,
};

describe('crypto helpers', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('s3cret', options);

    expect(hash).toBeTypeOf('string');
    expect(await verifyPassword(hash, 's3cret', options)).toBe(true);
  });

  it('rejects invalid passwords', async () => {
    const hash = await hashPassword('password', options);

    expect(await verifyPassword(hash, 'other', options)).toBe(false);
  });

  it('requires a hash to verify', async () => {
    await expect(verifyPassword('', 'value', options)).rejects.toThrow(/Hash value/);
  });
});
