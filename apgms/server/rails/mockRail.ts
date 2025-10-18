export interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export type TransferStatus = 'settled' | 'failed';

export interface TransferReceipt {
  id: string;
  status: TransferStatus;
  requestedAt: Date;
  completedAt: Date;
  request: TransferRequest;
  failureReason?: string;
}

export interface MockRailOptions {
  latencyMs?: number;
  clock?: () => Date;
  idFactory?: (request: TransferRequest) => string;
  onTransfer?: (receipt: TransferReceipt) => void;
}

const defaultIdFactory = () => `mock-${Math.random().toString(36).slice(2)}-${Date.now()}`;

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export class MockRail {
  private history: TransferReceipt[] = [];

  constructor(private readonly options: MockRailOptions = {}) {}

  public getTransfers(): TransferReceipt[] {
    return [...this.history];
  }

  public reset(): void {
    this.history = [];
  }

  public async transfer(request: TransferRequest): Promise<TransferReceipt> {
    if (request.amount <= 0) {
      throw new Error('Transfer amount must be greater than zero.');
    }

    const requestedAt = this.options.clock?.() ?? new Date();

    if (this.options.latencyMs && this.options.latencyMs > 0) {
      await sleep(this.options.latencyMs);
    }

    const completedAt = this.options.clock?.() ?? new Date();

    const receipt: TransferReceipt = {
      id: this.options.idFactory?.(request) ?? defaultIdFactory(),
      status: 'settled',
      requestedAt,
      completedAt,
      request: { ...request },
    };

    this.history.push(receipt);
    this.options.onTransfer?.(receipt);

    return receipt;
  }
}
