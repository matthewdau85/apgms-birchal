import { decodeAtoFault, SubmissionError } from "./errors";
import { SoapClient, SoapFaultError } from "../clients";

export interface PayrollEmployee {
  tfnd: string;
  gross: number;
  taxWithheld: number;
}

export interface PayrollSubmissionPayload {
  abn: string;
  payPeriodStart: string; // YYYY-MM-DD
  payPeriodEnd: string; // YYYY-MM-DD
  employees: PayrollEmployee[];
}

export interface PayrollSubmissionResult {
  receiptId: string;
  lodgementTime: string;
  status: "ACCEPTED" | "RECEIVED" | "ERROR";
}

export interface PayrollSubmissionHandlerOptions {
  client: SoapClient;
  maxRetries?: number;
  sleep?: (attempt: number) => Promise<void>;
}

export class PayrollSubmissionHandler {
  private readonly client: SoapClient;
  private readonly maxRetries: number;
  private readonly sleep: (attempt: number) => Promise<void>;

  constructor(options: PayrollSubmissionHandlerOptions) {
    this.client = options.client;
    this.maxRetries = options.maxRetries ?? 2;
    this.sleep =
      options.sleep ?? (async () => new Promise((resolve) => setTimeout(resolve, 250)));
  }

  async submit(payload: PayrollSubmissionPayload): Promise<PayrollSubmissionResult> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.client.send(
          "SubmitPayroll",
          this.buildPayload(payload),
        );
        const body = this.extractResponse(response);
        return {
          receiptId: body.ReceiptNumber,
          lodgementTime: body.LodgementTime,
          status: (body.ProcessingStatus as PayrollSubmissionResult["status"]) ?? "ACCEPTED",
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
            `Failed to submit payroll event: ${decoded.message}`,
            error.fault,
            decoded,
          );
        }
        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to submit payroll event due to unknown error");
  }

  private buildPayload(payload: PayrollSubmissionPayload): string {
    const employees = payload.employees
      .map(
        (emp) => `<pay:Employee>
        <pay:TFND>${emp.tfnd}</pay:TFND>
        <pay:Gross>${emp.gross.toFixed(2)}</pay:Gross>
        <pay:TaxWithheld>${emp.taxWithheld.toFixed(2)}</pay:TaxWithheld>
      </pay:Employee>`,
      )
      .join("");

    return `<pay:SubmitPayrollRequest xmlns:pay="http://ato.gov.au/sbr/payroll">
      <pay:ABN>${payload.abn}</pay:ABN>
      <pay:PayPeriodStart>${payload.payPeriodStart}</pay:PayPeriodStart>
      <pay:PayPeriodEnd>${payload.payPeriodEnd}</pay:PayPeriodEnd>
      <pay:Employees>${employees}</pay:Employees>
    </pay:SubmitPayrollRequest>`;
  }

  private extractResponse(response: Record<string, unknown>) {
    const submitResponse =
      (response["SubmitPayrollResponse"] as Record<string, string> | undefined) ??
      (response["pay:SubmitPayrollResponse"] as Record<string, string> | undefined);

    if (!submitResponse) {
      throw new Error("Unexpected payroll submission response shape");
    }

    return {
      ReceiptNumber: submitResponse.ReceiptNumber ?? submitResponse["pay:ReceiptNumber"],
      ProcessingStatus:
        submitResponse.ProcessingStatus ?? submitResponse["pay:ProcessingStatus"] ?? "ACCEPTED",
      LodgementTime:
        submitResponse.LodgementTime ?? submitResponse["pay:LodgementTime"] ?? new Date().toISOString(),
    };
  }
}
