import bcrypt from "bcryptjs";

const DEFAULT_ROUNDS = 12;

export function hash(value: string, rounds = DEFAULT_ROUNDS): Promise<string> {
  return bcrypt.hash(value, rounds);
}

export function verify(value: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(value, hashed);
}

export const cryptoConfig = {
  rounds: DEFAULT_ROUNDS,
};
