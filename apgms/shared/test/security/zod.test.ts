import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateRequest, validateResponse, zodErrorToHttp, ZodValidationError } from '../../src/security/zod';

describe('zod helpers', () => {
  it('converts Zod errors into HTTP friendly format', () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({});

    if (result.success) {
      throw new Error('Expected validation to fail');
    }

    const httpError = zodErrorToHttp(result.error, 422);
    expect(httpError.statusCode).toBe(422);
    expect(httpError.issues[0]).toMatchObject({ path: 'name' });
  });

  it('validates requests using provided schemas', () => {
    const data = validateRequest(
      {
        body: z.object({ email: z.string().email() }),
        query: z.object({ page: z.coerce.number().int().min(1) }),
      },
      {
        body: { email: 'user@example.com' },
        query: { page: '2' },
      },
    );

    expect(data.body.email).toBe('user@example.com');
    expect(data.query.page).toBe(2);
  });

  it('throws when any request part fails validation', () => {
    expect(() =>
      validateRequest(
        { body: z.object({ id: z.string().uuid() }) },
        { body: { id: 'not-a-uuid' } },
      ),
    ).toThrow(ZodValidationError);
  });

  it('validates responses', () => {
    const schema = z.object({ id: z.string().uuid() });
    const payload = { id: randomUUID() };

    expect(validateResponse(schema, payload)).toEqual(payload);
  });

  it('throws when response validation fails', () => {
    const schema = z.object({ id: z.string().uuid() });

    expect(() => validateResponse(schema, { id: '123' })).toThrow(ZodValidationError);
  });
});
