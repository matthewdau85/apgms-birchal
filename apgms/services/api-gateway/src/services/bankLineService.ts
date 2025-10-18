import { FastifyBaseLogger } from "fastify";
import { ServiceError } from "../utils/errors";
import { PrismaLike } from "./types";

export interface BankLine {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
}

export interface CreateBankLineInput {
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
}

export class BankLineService {
  constructor(private readonly prisma: PrismaLike, private readonly logger: FastifyBaseLogger) {}

  async listLatest(limit: number): Promise<BankLine[]> {
    try {
      const lines = (await this.prisma.bankLine.findMany({
        orderBy: { date: "desc" },
        take: limit,
      })) as any[];
      return lines.map((line) => ({
        id: String(line.id),
        orgId: String(line.orgId),
        date: new Date(line.date),
        amount: Number(line.amount),
        payee: String(line.payee),
        desc: String(line.desc),
        createdAt: new Date(line.createdAt),
      }));
    } catch (error) {
      this.logger.error({ err: error }, "Failed to list bank lines");
      throw new ServiceError("internal", "Unable to list bank lines", 500);
    }
  }

  async createLine(input: CreateBankLineInput): Promise<BankLine> {
    try {
      const created = (await this.prisma.bankLine.create({
        data: {
          orgId: input.orgId,
          date: input.date,
          amount: input.amount,
          payee: input.payee,
          desc: input.desc,
        },
      })) as any;
      return {
        id: String(created.id),
        orgId: String(created.orgId),
        date: new Date(created.date),
        amount: Number(created.amount),
        payee: String(created.payee),
        desc: String(created.desc),
        createdAt: new Date(created.createdAt),
      };
    } catch (error) {
      this.logger.error({ err: error, input }, "Failed to create bank line");
      throw new ServiceError("internal", "Unable to create bank line", 500);
    }
  }
}
