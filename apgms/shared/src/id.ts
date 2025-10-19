export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}_${random}${timestamp}`;
}
