import { createHash } from "node:crypto";

type UserRecord = {
  id: string;
  email: string | null;
  password: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: unknown;
  payee: string | null;
  desc: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

type AuditBlobRecord = {
  id?: string;
  event: string;
  payload: unknown;
  redactedAt?: Date;
};

type FindManyArgs = { where: { createdAt: { lt: Date }; deletedAt: null } };
type UpdateArgs<T> = { where: { id: string }; data: Partial<T> };
type CreateArgs<T> = { data: T };

export interface RedactionClient {
  user: {
    findMany(args: FindManyArgs): Promise<UserRecord[]>;
    update(args: UpdateArgs<UserRecord>): Promise<UserRecord>;
  };
  bankLine: {
    findMany(args: FindManyArgs): Promise<BankLineRecord[]>;
    update(args: UpdateArgs<BankLineRecord>): Promise<BankLineRecord>;
  };
  auditBlob: {
    create(args: CreateArgs<AuditBlobRecord>): Promise<unknown>;
  };
}

export interface RedactJobOptions {
  prisma: RedactionClient;
  retentionDays?: number;
  dryRun?: boolean;
  now?: Date;
  log?: (message: string) => void;
}

type HashedUser = {
  id: string;
  emailHash: string | null;
  passwordHash: string | null;
};

type HashedBankLine = {
  id: string;
  payeeHash: string | null;
  descHash: string | null;
};

export interface RedactJobSummary {
  dryRun: boolean;
  retentionDays: number;
  cutoff: string;
  users: {
    total: number;
    hashed: HashedUser[];
  };
  bankLines: {
    total: number;
    hashed: HashedBankLine[];
  };
}

const DEFAULT_RETENTION_DAYS = 365;

const envRetention = Number.parseInt(process.env.RETENTION_DAYS_PII ?? "", 10);

export const RETENTION_DAYS_PII = Number.isFinite(envRetention) && envRetention > 0
  ? envRetention
  : DEFAULT_RETENTION_DAYS;

export async function runRedactionJob({
  prisma,
  retentionDays = RETENTION_DAYS_PII,
  dryRun = false,
  now = new Date(),
  log = console.log,
}: RedactJobOptions): Promise<RedactJobSummary> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const [staleUsers, staleBankLines] = await Promise.all([
    prisma.user.findMany({
      where: {
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
    }),
    prisma.bankLine.findMany({
      where: {
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
    }),
  ]);

  const hashedUsers = staleUsers.map<HashedUser>((user) => ({
    id: user.id,
    emailHash: hashValue(user.email),
    passwordHash: hashValue(user.password),
  }));

  const hashedBankLines = staleBankLines.map<HashedBankLine>((line) => ({
    id: line.id,
    payeeHash: hashValue(line.payee),
    descHash: hashValue(line.desc),
  }));

  if (!dryRun) {
    await Promise.all([
      ...staleUsers.map((user) =>
        prisma.user.update({
          where: { id: user.id },
          data: { email: null, password: null, deletedAt: now },
        })
      ),
      ...staleBankLines.map((line) =>
        prisma.bankLine.update({
          where: { id: line.id },
          data: { payee: null, desc: null, deletedAt: now },
        })
      ),
    ]);

    if (staleUsers.length > 0 || staleBankLines.length > 0) {
      await prisma.auditBlob.create({
        data: {
          event: "pii.redacted",
          payload: {
            retentionDays,
            cutoff: cutoff.toISOString(),
            users: hashedUsers,
            bankLines: hashedBankLines,
          },
          redactedAt: now,
        },
      });
    }
  }

  const summary: RedactJobSummary = {
    dryRun,
    retentionDays,
    cutoff: cutoff.toISOString(),
    users: {
      total: staleUsers.length,
      hashed: hashedUsers,
    },
    bankLines: {
      total: staleBankLines.length,
      hashed: hashedBankLines,
    },
  };

  if (dryRun) {
    log(JSON.stringify(summary));
  }

  return summary;
}

function hashValue(value: string | null): string | null {
  if (value == null) {
    return null;
  }

  return createHash("sha256").update(value).digest("hex");
}
