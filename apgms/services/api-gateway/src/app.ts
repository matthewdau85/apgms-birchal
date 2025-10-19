import cors from "@fastify/cors";
import Fastify, { FastifyInstance } from "fastify";
import { prisma as sharedPrisma } from "../../../shared/src/db";
import { z } from "zod";
import {
  BankLineLike,
  composeUpcomingObligations,
  deriveHistories,
} from "./obligations";

type PrismaBankLineArgs = Parameters<typeof sharedPrisma.bankLine.findMany>[0];

type PrismaLike = {
  user: {
    findMany: (args?: Parameters<typeof sharedPrisma.user.findMany>[0]) => Promise<unknown[]>;
  };
  bankLine: {
    findMany: (args?: PrismaBankLineArgs) => Promise<BankLineRecord[]>;
    create: typeof sharedPrisma.bankLine.create;
  };
};

interface BankLineRecord {
  id?: string;
  orgId: string;
  date: Date | string;
  amount: unknown;
  payee: string;
  desc: string;
}

export interface AlertSubscription {
  orgId: string;
  email: string;
  thresholdCents: number;
}

export interface AlertPayload extends AlertSubscription {
  cashOnHandCents: number;
  totalForecastCents: number;
  deficitCents: number;
}

export type AlertSender = (payload: AlertPayload) => Promise<void> | void;

export interface CreateAppOptions {
  prisma?: PrismaLike;
  alertSender?: AlertSender;
}

const subscribeSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  thresholdCents: z.number().int().nonnegative(),
});

const upcomingQuerySchema = z.object({
  orgId: z.string().min(1),
});

function toBankLineLike(record: BankLineRecord): BankLineLike {
  return {
    date: record.date instanceof Date ? record.date : new Date(record.date),
    amount: record.amount,
    desc: record.desc ?? "",
    payee: record.payee ?? "",
  };
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });
  const prisma = options.prisma ?? (sharedPrisma as PrismaLike);
  const alertSender: AlertSender = options.alertSender ?? ((payload) => {
    app.log.info({ obligationAlert: payload });
  });
  const alertSubscriptions = new Map<string, AlertSubscription[]>();

  app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    } as any);
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    } as PrismaBankLineArgs);
    return { lines };
  });

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
      } as any);
      return rep.code(201).send(created);
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  app.get("/obligations/upcoming", async (req, rep) => {
    const parseResult = upcomingQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return rep.code(400).send({ error: "invalid_query" });
    }
    const { orgId } = parseResult.data;
    const lines = await prisma.bankLine.findMany({
      where: { orgId },
      orderBy: { date: "asc" },
    } as PrismaBankLineArgs);
    const histories = deriveHistories(lines.map(toBankLineLike));
    const composition = composeUpcomingObligations({
      basHistory: histories.basHistory,
      payrollHistory: histories.payrollHistory,
      basFrequency: histories.basFrequency,
      paygwFrequency: histories.paygwFrequency,
      cashOnHandCents: histories.cashOnHandCents,
    });
    const orgSubscriptions = alertSubscriptions.get(orgId) ?? [];
    for (const subscription of orgSubscriptions) {
      const deficit = composition.cashOnHandCents - composition.totalForecastCents;
      if (deficit < subscription.thresholdCents) {
        await alertSender({
          ...subscription,
          cashOnHandCents: composition.cashOnHandCents,
          totalForecastCents: composition.totalForecastCents,
          deficitCents: deficit,
        });
      }
    }
    return {
      obligations: composition.obligations,
      basFrequency: composition.basFrequency,
      paygwSchedule: composition.paygwSchedule,
      cashOnHandCents: composition.cashOnHandCents,
    };
  });

  app.post("/alerts/subscribe", async (req, rep) => {
    const parseResult = subscribeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return rep.code(400).send({ error: "invalid_body" });
    }
    const subscription = parseResult.data;
    const existing = alertSubscriptions.get(subscription.orgId) ?? [];
    const next = existing.filter((item) => item.email !== subscription.email);
    next.push(subscription);
    alertSubscriptions.set(subscription.orgId, next);
    return rep.code(204).send();
  });

  return app;
}

