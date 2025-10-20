export const welcomeMessage = (name: string): string => {
  const trimmed = name.trim();
  return trimmed.length === 0 ? "Welcome!" : `Welcome, ${trimmed}!`;
};
