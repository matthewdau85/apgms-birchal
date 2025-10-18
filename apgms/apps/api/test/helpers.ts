export const replace = <T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K],
): (() => void) => {
  const original = target[key];
  Object.assign(target, { [key]: value });
  return () => {
    Object.assign(target, { [key]: original });
  };
};
