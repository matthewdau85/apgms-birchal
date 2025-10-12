import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { parse } from "csv-parse/sync";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, {
  attachFieldsToBody: false,
});

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

// List users (email + org)
app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

// List bank lines (latest first)
app.get("/bank-lines", async (req) => {
  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  try {
    const body = req.body as {
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
    };
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
    });
    return rep.code(201).send(created);
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  }
});

const expectedHeaders = [
  "date",
  "amount",
  "payee",
  "desc",
  "currency",
  "externalId",
  "source",
  "cleared",
];

type CsvRecord = Record<(typeof expectedHeaders)[number], string>;

app.post("/bank-lines/import", async (req, rep) => {
  const parts = req.parts();
  let orgId: string | undefined;
  let fileBuffer: Buffer | undefined;

  for await (const part of parts) {
    if (part.type === "file") {
      if (!fileBuffer && part.fieldname === "file") {
        fileBuffer = await part.toBuffer();
      } else {
        await part.toBuffer();
      }
    } else if (part.type === "field" && part.fieldname === "orgId") {
      orgId = String(part.value).trim();
    }
  }

  if (!orgId) {
    return rep.code(400).send({ error: "orgId_required" });
  }

  if (!fileBuffer) {
    return rep.code(400).send({ error: "file_required" });
  }

  let records: CsvRecord[];
  try {
    records = parse(fileBuffer.toString("utf8"), {
      columns: (header) => {
        const normalized = header.map((h) => h.trim().toLowerCase());
        const expected = expectedHeaders.map((h) => h.toLowerCase());
        if (
          normalized.length !== expected.length ||
          normalized.some((value, index) => value !== expected[index])
        ) {
          throw new Error(
            `Invalid headers. Expected: ${expectedHeaders.join(",")}`
          );
        }
        return expectedHeaders;
      },
      skip_empty_lines: true,
      trim: true,
    }) as CsvRecord[];
  } catch (error) {
    req.log.error(error);
    return rep
      .code(400)
      .send({ error: "invalid_csv", reason: (error as Error).message });
  }

  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as { row: number; reason: string }[],
  };

  for (let index = 0; index < records.length; index += 1) {
    const rowNumber = index + 2; // header row is 1
    const record = records[index];
    const normalized = normalizeRecord(record);

    if (normalized.errors.length > 0) {
      summary.skipped += 1;
      summary.errors.push({
        row: rowNumber,
        reason: normalized.errors.join("; "),
      });
      continue;
    }

    const data = {
      date: normalized.date!,
      amount: normalized.amount!,
      payee: normalized.payee!,
      desc: normalized.desc!,
      currency: normalized.currency!,
      source: normalized.source,
      cleared: normalized.cleared!,
    };

    try {
      if (normalized.externalId) {
        const existing = await prisma.bankLine.findUnique({
          where: {
            orgId_externalId: {
              orgId,
              externalId: normalized.externalId,
            },
          },
        });

        if (existing) {
          await prisma.bankLine.update({
            where: {
              orgId_externalId: {
                orgId,
                externalId: normalized.externalId,
              },
            },
            data,
          });
          summary.updated += 1;
        } else {
          await prisma.bankLine.create({
            data: {
              orgId,
              externalId: normalized.externalId,
              ...data,
            },
          });
          summary.created += 1;
        }
      } else {
        await prisma.bankLine.create({
          data: {
            orgId,
            ...data,
          },
        });
        summary.created += 1;
      }
    } catch (error) {
      req.log.error(error, "Failed to persist bank line");
      summary.skipped += 1;
      summary.errors.push({
        row: rowNumber,
        reason: `Database error: ${(error as Error).message}`,
      });
    }
  }

  return summary;
});

type NormalizedRecord = {
  date?: Date;
  amount?: Prisma.Decimal;
  payee?: string;
  desc?: string;
  currency?: string;
  externalId?: string;
  source?: string;
  cleared?: boolean;
  errors: string[];
};

function normalizeRecord(record: CsvRecord): NormalizedRecord {
  const errors: string[] = [];
  const getValue = (key: keyof CsvRecord) => record[key]?.toString().trim() ?? "";

  const dateValue = getValue("date");
  let date: Date | undefined;
  if (!dateValue) {
    errors.push("date is required");
  } else {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      errors.push("date is invalid");
    } else {
      date = new Date(parsed.toISOString());
    }
  }

  const amountValue = getValue("amount").replace(/,/g, "");
  let amount: Prisma.Decimal | undefined;
  if (!amountValue) {
    errors.push("amount is required");
  } else if (!/^-?\d+(\.\d+)?$/.test(amountValue)) {
    errors.push("amount is invalid");
  } else {
    const [integerPart, fractionPart = ""] = amountValue
      .replace(/^-/, "")
      .split(".");
    if (integerPart.length > 16) {
      errors.push("amount exceeds maximum precision");
    } else if (fractionPart.length > 2) {
      errors.push("amount must have at most 2 decimal places");
    } else {
      try {
        amount = new Prisma.Decimal(amountValue);
      } catch (error) {
        errors.push("amount is invalid");
      }
    }
  }

  const payee = getValue("payee");
  if (!payee) {
    errors.push("payee is required");
  }

  const desc = getValue("desc");
  if (!desc) {
    errors.push("desc is required");
  }

  const currencyRaw = getValue("currency");
  const currency = (currencyRaw || "AUD").toUpperCase();

  const externalIdRaw = getValue("externalId");
  const externalId = externalIdRaw ? externalIdRaw : undefined;

  const sourceRaw = getValue("source");
  const source = sourceRaw || undefined;

  const clearedRaw = getValue("cleared").toLowerCase();
  let cleared: boolean | undefined;
  if (!clearedRaw) {
    cleared = false;
  } else if (["true", "1", "yes"].includes(clearedRaw)) {
    cleared = true;
  } else if (["false", "0", "no"].includes(clearedRaw)) {
    cleared = false;
  } else {
    errors.push("cleared is invalid");
  }

  return {
    date,
    amount,
    payee: payee || undefined,
    desc: desc || undefined,
    currency,
    externalId,
    source,
    cleared,
    errors,
  };
}

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

