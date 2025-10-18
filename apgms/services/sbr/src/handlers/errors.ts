import type { SoapFault } from "../clients";

export interface DecodedFault {
  code: string;
  message: string;
  retryable: boolean;
}

const FAULT_MAPPINGS: Record<string, DecodedFault> = {
  "ATO.SERVICE.UNAVAILABLE": {
    code: "service_unavailable",
    message: "ATO services are temporarily unavailable. Please retry shortly.",
    retryable: true,
  },
  "ATO.GENERAL.RETRY": {
    code: "general_retry",
    message: "Temporary outage communicating with the ATO.",
    retryable: true,
  },
  "ATO.AUTH.INVALID": {
    code: "auth_invalid",
    message: "Authentication with the ATO failed.",
    retryable: false,
  },
  "ATO.BAS.FORM.INVALID": {
    code: "bas_form_invalid",
    message: "Submitted BAS form failed ATO validation.",
    retryable: false,
  },
  "ATO.PAYROLL.OUTAGE": {
    code: "payroll_outage",
    message: "ATO payroll services are currently unavailable.",
    retryable: true,
  },
  "ATO.PAYROLL.NOT_FOUND": {
    code: "payroll_not_found",
    message: "Payroll lodgement could not be found.",
    retryable: false,
  },
};

export const DEFAULT_DECODED_FAULT: DecodedFault = {
  code: "unknown_fault",
  message: "An unknown SOAP fault was returned by the ATO.",
  retryable: false,
};

export function decodeAtoFault(fault: SoapFault): DecodedFault {
  const detail =
    typeof fault.detail === "string"
      ? fault.detail
      : (fault.detail && JSON.stringify(fault.detail)) || "";

  const matchedKey = Object.keys(FAULT_MAPPINGS).find((key) => detail.includes(key));
  if (matchedKey) {
    return FAULT_MAPPINGS[matchedKey];
  }

  const normalized = fault.code.toUpperCase();
  if (FAULT_MAPPINGS[normalized]) {
    return FAULT_MAPPINGS[normalized];
  }

  return {
    ...DEFAULT_DECODED_FAULT,
    message: fault.message || DEFAULT_DECODED_FAULT.message,
  };
}

export class SubmissionError extends Error {
  readonly decodedFault: DecodedFault;
  readonly fault: SoapFault;

  constructor(message: string, fault: SoapFault, decodedFault: DecodedFault) {
    super(message);
    this.name = "SubmissionError";
    this.decodedFault = decodedFault;
    this.fault = fault;
  }
}
