import { decodeAtoFault, SubmissionError } from "./errors";
import { SoapClient, SoapFaultError } from "../clients";

export interface BasSubmissionPayload {
  abn: string;
  period: string; // YYYY-MM
  grossSales: number;
  gstOnSales: number;
  gstOnPurchases: number;
}

export interface BasSubmissionResult {
  receiptId: string;
  lodgementTime: string;
  status: "ACCEPTED" | "RECEIVED" | "ERROR";
}

export interface BasSubmissionHandlerOptions {
  client: SoapClient;
  maxRetries?: number;
  sleep?: (attempt: number) => Promise<void>;
}

export class BasSubmissionHandler {
  private readonly client: SoapClient;
  private readonly maxRetries: number;
  private readonly sleep: (attempt: number) => Promise<void>;

  constructor(options: BasSubmissionHandlerOptions) {
    this.client = options.client;
    this.maxRetries = options.maxRetries ?? 2;
    this.sleep =
      options.sleep ?? (async () => new Promise((resolve) => setTimeout(resolve, 250)));
  }

  async submit(payload: BasSubmissionPayload): Promise<BasSubmissionResult> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.client.send("SubmitBAS", this.buildPayload(payload));
        const body = this.extractResponse(response);
        return {
          receiptId: body.ReceiptNumber,
          lodgementTime: body.LodgementTime,
          status: (body.ProcessingStatus as BasSubmissionResult["status"]) ?? "ACCEPTED",
        };
      } catch (error) {
        lastError = error;
        if (error instanceof SoapFaultError) {
          const decoded = decodeAtoFault(error.fault);
          if (decoded.retryable && attempt < this.maxRetries) {
            attempt += 1;
            await this.sleep(attempt);
            continue;
          }

          throw new SubmissionError(
            `Failed to submit BAS form: ${decoded.message}`,
            error.fault,
            decoded,
          );
        }
        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to submit BAS form due to unknown error");
  }

  private buildPayload(payload: BasSubmissionPayload): string {
    return `<bas:SubmitBASRequest xmlns:bas="http://ato.gov.au/sbr/bas">
      <bas:ABN>${payload.abn}</bas:ABN>
      <bas:Period>${payload.period}</bas:Period>
      <bas:GrossSales>${payload.grossSales.toFixed(2)}</bas:GrossSales>
      <bas:GstOnSales>${payload.gstOnSales.toFixed(2)}</bas:GstOnSales>
      <bas:GstOnPurchases>${payload.gstOnPurchases.toFixed(2)}</bas:GstOnPurchases>
    </bas:SubmitBASRequest>`;
  }

  private extractResponse(response: Record<string, unknown>) {
    const submitResponse =
      (response["SubmitBASResponse"] as Record<string, string> | undefined) ??
      (response["bas:SubmitBASResponse"] as Record<string, string> | undefined);

    if (!submitResponse) {
      throw new Error("Unexpected BAS submission response shape");
    }

    return {
      ReceiptNumber: submitResponse.ReceiptNumber ?? submitResponse["bas:ReceiptNumber"],
      ProcessingStatus:
        submitResponse.ProcessingStatus ?? submitResponse["bas:ProcessingStatus"] ?? "ACCEPTED",
      LodgementTime:
        submitResponse.LodgementTime ?? submitResponse["bas:LodgementTime"] ?? new Date().toISOString(),
    };
  }
}
