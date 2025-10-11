export const parseDurationSeconds = (value: string | undefined, fallbackSeconds: number): number => {
  if (!value) {
    return fallbackSeconds;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return fallbackSeconds;
  }

  const directNumber = Number(trimmed);
  if (!Number.isNaN(directNumber) && directNumber > 0) {
    return Math.floor(directNumber);
  }

  const match = /^([0-9]+)\s*([smhd])$/i.exec(trimmed);
  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
  };

  return amount > 0 ? amount * factor[unit] : fallbackSeconds;
};
