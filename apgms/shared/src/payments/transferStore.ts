import { Prisma, PrismaClient } from "@prisma/client";
import { transferDtoSchema, transferEventDtoSchema } from "./types";
import type {
  CreateTransferInput,
  PersistedTransferRepository,
  TransferEventRecord,
  TransferRecord,
  UpdateTransferInput,
} from "./repository";

function toJsonValue(value: Record<string, unknown> | null | undefined): Prisma.JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.JsonValue;
}

function mapTransfer(record: {
  id: string;
  orgId: string;
  requestId: string;
  rail: string;
  amount: Prisma.Decimal;
  currency: string;
  status: "PENDING" | "SUBMITTED" | "SETTLED" | "FAILED";
  externalId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): TransferRecord {
  return transferDtoSchema.parse({
    id: record.id,
    orgId: record.orgId,
    requestId: record.requestId,
    rail: record.rail,
    amount: {
      currency: record.currency,
      value: record.amount.toFixed(2),
    },
    status: record.status,
    externalId: record.externalId,
    metadata: (record.metadata ?? null) as Record<string, unknown> | null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function mapEvent(record: {
  id: string;
  transferId: string;
  requestId: string;
  kind: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}): TransferEventRecord {
  return transferEventDtoSchema.parse({
    id: record.id,
    transferId: record.transferId,
    requestId: record.requestId,
    kind: record.kind,
    payload: record.payload as unknown,
    createdAt: record.createdAt,
  });
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export class TransferStore implements PersistedTransferRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createTransfer(input: CreateTransferInput): Promise<TransferRecord> {
    try {
      const result = await this.prisma.transfer.create({
        data: {
          orgId: input.orgId,
          requestId: input.requestId,
          rail: input.rail as Prisma.TransferRail,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
          metadata: toJsonValue(input.metadata) ?? Prisma.JsonNull,
        },
      });
      return mapTransfer(result);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.prisma.transfer.findUnique({
          where: { requestId: input.requestId },
        });
        if (existing) {
          return mapTransfer(existing);
        }
      }
      throw error;
    }
  }

  async findByRequestId(requestId: string): Promise<TransferRecord | null> {
    const result = await this.prisma.transfer.findUnique({
      where: { requestId },
    });
    return result ? mapTransfer(result) : null;
  }

  async getById(id: string): Promise<TransferRecord | null> {
    const result = await this.prisma.transfer.findUnique({
      where: { id },
    });
    return result ? mapTransfer(result) : null;
  }

  async updateTransfer(id: string, input: UpdateTransferInput): Promise<TransferRecord> {
    const result = await this.prisma.transfer.update({
      where: { id },
      data: {
        status: input.status,
        externalId: input.externalId,
        metadata: toJsonValue(input.metadata),
      },
    });
    return mapTransfer(result);
  }

  async saveEvent(input: {
    transferId: string;
    requestId: string;
    kind: string;
    payload: Record<string, unknown>;
  }): Promise<TransferEventRecord> {
    try {
      const result = await this.prisma.transferEvent.create({
        data: {
          transferId: input.transferId,
          requestId: input.requestId,
          kind: input.kind,
          payload: input.payload as Prisma.JsonObject,
        },
      });
      return mapEvent(result);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.prisma.transferEvent.findUnique({
          where: { requestId: input.requestId },
        });
        if (existing) {
          return mapEvent(existing);
        }
      }
      throw error;
    }
  }

  async getEventByRequestId(requestId: string): Promise<TransferEventRecord | null> {
    const result = await this.prisma.transferEvent.findUnique({
      where: { requestId },
    });
    return result ? mapEvent(result) : null;
  }

  async listEvents(transferId: string): Promise<TransferEventRecord[]> {
    const results = await this.prisma.transferEvent.findMany({
      where: { transferId },
      orderBy: { createdAt: "asc" },
    });
    return results.map(mapEvent);
  }
}
