import argon2, { Options as ArgonOptions } from 'argon2';

export interface Argon2idOptions {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  saltLength?: number;
}

const defaultSaltLength = 16;

function toArgonOptions(options: Argon2idOptions): ArgonOptions & { type: typeof argon2.argon2id } {
  return {
    type: argon2.argon2id,
    memoryCost: options.memoryCost,
    timeCost: options.timeCost,
    parallelism: options.parallelism,
    saltLength: options.saltLength ?? defaultSaltLength,
  };
}

export async function hashPassword(plainText: string, options: Argon2idOptions): Promise<string> {
  if (!plainText) {
    throw new Error('Plain text value is required for hashing');
  }

  return argon2.hash(plainText, toArgonOptions(options));
}

export async function verifyPassword(hash: string, plainText: string, options: Argon2idOptions): Promise<boolean> {
  if (!hash) {
    throw new Error('Hash value is required for verification');
  }

  if (!plainText) {
    return false;
  }

  return argon2.verify(hash, plainText, toArgonOptions(options));
}
