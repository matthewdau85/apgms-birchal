import crypto from 'node:crypto';

export function createHmacSignature(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeJsonStringify(data) {
  return JSON.stringify(data, (_key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  });
}
