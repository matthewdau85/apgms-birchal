import { describe, expect, it } from 'vitest';
import { issueTokens, JwtConfig, JwtSecrets, rotateTokens, verifyAccessToken, verifyRefreshToken } from '../../src/security/jwt';

const config: JwtConfig = {
  issuer: 'apgms',
  audience: 'shared-service',
  accessTokenTtl: '2m',
  refreshTokenTtl: '10m',
  clockSkewInSeconds: 5,
};

const secrets: JwtSecrets = {
  access: 'access-secret',
  refresh: 'refresh-secret',
};

describe('jwt helpers', () => {
  it('issues and verifies access and refresh tokens', async () => {
    const tokens = await issueTokens(config, secrets, {
      subject: 'user-1',
      claims: { role: 'admin' },
      accessJti: 'access-1',
      refreshJti: 'refresh-1',
    });

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const accessVerification = await verifyAccessToken(tokens.accessToken, config, secrets);
    const refreshVerification = await verifyRefreshToken(tokens.refreshToken, config, secrets);

    expect(accessVerification.payload.sub).toBe('user-1');
    expect(accessVerification.payload.role).toBe('admin');
    expect(accessVerification.payload.jti).toBe('access-1');
    expect(refreshVerification.payload.jti).toBe('refresh-1');
  });

  it('rotates tokens when refresh token is valid', async () => {
    const initial = await issueTokens(config, secrets, {
      subject: 'user-2',
      refreshJti: 'refresh-2',
    });

    const rotated = await rotateTokens(config, secrets, {
      refreshToken: initial.refreshToken,
      expectedRefreshJti: 'refresh-2',
      accessJti: 'access-rotated',
      refreshJti: 'refresh-rotated',
      claims: { scope: ['read'] },
    });

    expect(rotated.refreshToken).not.toBe(initial.refreshToken);

    const verification = await verifyAccessToken(rotated.accessToken, config, secrets);
    expect(verification.payload.scope).toEqual(['read']);
    expect(verification.payload.jti).toBe('access-rotated');
  });

  it('throws when refresh token JTI does not match expectation', async () => {
    const initial = await issueTokens(config, secrets, {
      subject: 'user-3',
      refreshJti: 'refresh-expected',
    });

    await expect(
      rotateTokens(config, secrets, {
        refreshToken: initial.refreshToken,
        expectedRefreshJti: 'different',
      }),
    ).rejects.toThrow(/identifier mismatch/);
  });
});
