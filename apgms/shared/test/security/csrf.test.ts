import { describe, expect, it } from 'vitest';
import { createCsrfHelper } from '../../src/security/csrf';

describe('csrf helper', () => {
  it('issues matching cookie and header tokens when enabled', () => {
    const helper = createCsrfHelper({ tokenLength: 16 });
    const issued = helper.issue();

    expect(issued).not.toBeNull();
    expect(issued?.cookie.value).toBe(issued?.token);
    expect(helper.verify(issued?.cookie.value, issued?.token)).toBe(true);
  });

  it('rejects mismatched tokens', () => {
    const helper = createCsrfHelper();

    expect(helper.verify('cookie', 'header')).toBe(false);
  });

  it('becomes a no-op when disabled', () => {
    const helper = createCsrfHelper({ enabled: false });

    expect(helper.issue()).toBeNull();
    expect(helper.verify(undefined, undefined)).toBe(true);
    expect(helper.isEnabled()).toBe(false);
  });
});
