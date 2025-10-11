import { readFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCRYPT_N = Number(process.env.PASSWORD_SCRYPT_N ?? 16384);
const SCRYPT_r = Number(process.env.PASSWORD_SCRYPT_R ?? 8);
const SCRYPT_p = Number(process.env.PASSWORD_SCRYPT_P ?? 1);
const KEY_LEN = Number(process.env.PASSWORD_KEYLEN ?? 64);

const passwordSource = process.argv
  .find((arg) => arg.startsWith("--passwords="))
  ?.split("=")[1]
  ?? process.env.PASSWORD_REHASH_FILE;

type PasswordMap = Record<string, string>;

type ParsedHash = {
  algorithm: string;
  params: Record<string, string>;
  salt: Buffer;
  digest: Buffer;
};

function parseHash(raw: string): ParsedHash | null {
  const [algorithm, ...rest] = raw.split("$");
  if (!algorithm) return null;
  const params: Record<string, string> = {};
  let salt: Buffer | null = null;
  let digest: Buffer | null = null;

  for (const segment of rest) {
    if (segment.startsWith("n=") || segment.startsWith("r=") || segment.startsWith("p=") || segment.startsWith("len=")) {
      const [key, value] = segment.split("=");
      if (key && value) {
        params[key] = value;
      }
    } else if (!salt) {
      salt = Buffer.from(segment, "base64");
    } else {
      digest = Buffer.from(segment, "base64");
    }
  }

  if (!salt || !digest) return null;
  return { algorithm, params, salt, digest };
}

function targetParamsMatch(parsed: ParsedHash | null) {
  if (!parsed) return false;
  return (
    parsed.algorithm === "scrypt" &&
    parsed.params["n"] === String(SCRYPT_N) &&
    parsed.params["r"] === String(SCRYPT_r) &&
    parsed.params["p"] === String(SCRYPT_p) &&
    parsed.params["len"] === String(KEY_LEN)
  );
}

async function loadPasswords(): Promise<PasswordMap> {
  if (!passwordSource) {
    return {};
  }

  try {
    const json = await readFile(passwordSource, "utf8");
    const parsed = JSON.parse(json) as PasswordMap;
    return parsed;
  } catch (error) {
    console.warn(`Unable to load password source from ${passwordSource}:`, error);
    return {};
  }
}

function deriveHash(password: string, salt?: Buffer) {
  const effectiveSalt = salt ?? randomBytes(16);
  const hash = scryptSync(password, effectiveSalt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: 128 * SCRYPT_N * SCRYPT_r,
  });

  return [
    "scrypt",
    `n=${SCRYPT_N}`,
    `r=${SCRYPT_r}`,
    `p=${SCRYPT_p}`,
    `len=${KEY_LEN}`,
    effectiveSalt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

async function main() {
  const passwords = await loadPasswords();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, passwordHash: true },
  });

  let updated = 0;
  for (const user of users) {
    const parsed = parseHash(user.passwordHash);
    if (targetParamsMatch(parsed)) {
      continue;
    }

    const plaintext = passwords[user.email];
    if (!plaintext) {
      console.warn(`Skipping ${user.email}: missing plaintext password`);
      continue;
    }

    const nextHash = deriveHash(plaintext, parsed?.salt);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: nextHash },
    });
    updated += 1;
  }

  console.log(`Rehashed ${updated} account(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
