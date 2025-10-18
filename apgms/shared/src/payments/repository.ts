import { TransferDto, TransferEventDto, TransferRail } from "./types";

export interface TransferRecord extends TransferDto {}
export interface TransferEventRecord extends TransferEventDto {}

export interface CreateTransferInput {
  orgId: string;
  requestId: string;
  rail: TransferRail;
  amount: string;
  currency: string;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateTransferInput {
  status?: "PENDING" | "SUBMITTED" | "SETTLED" | "FAILED";
  externalId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PersistedTransferRepository {
  createTransfer(input: CreateTransferInput): Promise<TransferRecord>;
  findByRequestId(requestId: string): Promise<TransferRecord | null>;
  getById(id: string): Promise<TransferRecord | null>;
  updateTransfer(id: string, input: UpdateTransferInput): Promise<TransferRecord>;
  saveEvent(input: {
    transferId: string;
    requestId: string;
    kind: string;
    payload: Record<string, unknown>;
  }): Promise<TransferEventRecord>;
  getEventByRequestId(requestId: string): Promise<TransferEventRecord | null>;
  listEvents(transferId: string): Promise<TransferEventRecord[]>;
}
