export type RandomGenerator = () => number;

export const createSeedRandom = (seed: string): RandomGenerator => {
  let h = 2166136261 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return ((h >>> 0) % 1000000) / 1000000;
  };
};

export const randomInt = (min: number, max: number, rng: RandomGenerator): number => {
  return Math.floor(rng() * (max - min + 1)) + min;
};

export const randomNumber = (min: number, max: number, rng: RandomGenerator): number => {
  return rng() * (max - min) + min;
};

export const randomPick = <T>(values: readonly T[], rng: RandomGenerator): T => {
  return values[randomInt(0, values.length - 1, rng)];
};

export const randomPastDate = (daysBack: number, rng: RandomGenerator): Date => {
  const now = new Date();
  const offsetDays = randomInt(0, daysBack, rng);
  const date = new Date(now);
  date.setDate(now.getDate() - offsetDays);
  date.setHours(randomInt(7, 18, rng), randomInt(0, 59, rng), 0, 0);
  return date;
};

export const toCurrency = (value: number): string => value.toFixed(2);

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

