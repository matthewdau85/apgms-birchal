import type { SoapFault, SoapResponse } from "./types";

export class SoapFaultError extends Error {
  readonly fault: SoapFault;
  readonly response: SoapResponse;

  constructor(message: string, fault: SoapFault, response: SoapResponse) {
    super(message);
    this.name = "SoapFaultError";
    this.fault = fault;
    this.response = response;
  }
}
