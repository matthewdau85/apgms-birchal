import { randomUUID } from "node:crypto";
import { SoapFaultError } from "./errors";
import type {
  AuthCredentials,
  SoapClientOptions,
  SoapFault,
  SoapRequest,
  SoapResponse,
  SoapTransport,
} from "./types";

const defaultTransport: SoapTransport = async (request: SoapRequest): Promise<SoapResponse> => {
  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    status: response.status,
    headers,
    body: await response.text(),
  };
};

export class SoapClient {
  private readonly endpoint: string;
  private readonly productId: string;
  private readonly credentials: AuthCredentials;
  private readonly transport: SoapTransport;
  private readonly userAgent: string;

  constructor(options: SoapClientOptions) {
    this.endpoint = options.endpoint;
    this.productId = options.productId;
    this.credentials = options.credentials;
    this.transport = options.transport ?? defaultTransport;
    this.userAgent = options.userAgent ?? "@apgms/sbr";
  }

  createEnvelope(body: string): string {
    const messageId = randomUUID();
    const securityHeader = this.buildSecurityHeader();
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:aus="http://ato.gov.au/auskey" xmlns:mg="http://ato.gov.au/mygovid" xmlns:com="http://ato.gov.au/common">
  <soap:Header>
    <com:MessageID>${messageId}</com:MessageID>
    <com:ProductId>${this.productId}</com:ProductId>
    ${securityHeader}
  </soap:Header>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
  }

  async send(action: string, body: string): Promise<Record<string, unknown>> {
    const envelope = this.createEnvelope(body);
    const response = await this.transport({
      url: this.endpoint,
      headers: {
        "content-type": "text/xml; charset=utf-8",
        soapaction: action,
        "user-agent": this.userAgent,
      },
      body: envelope,
    });

    const parsed = this.parseResponse(response);
    if (parsed.fault) {
      throw new SoapFaultError(
        `SOAP fault returned for action ${action}: ${parsed.fault.message}`,
        parsed.fault,
        response,
      );
    }

    return parsed.body;
  }

  private buildSecurityHeader(): string {
    if (this.credentials.type === "auskey") {
      return `<aus:Authentication>
        <aus:ABN>${this.credentials.abn}</aus:ABN>
        <aus:SerialNumber>${this.credentials.serialNumber}</aus:SerialNumber>
        <aus:KeystoreID>${this.credentials.keystoreId}</aus:KeystoreID>
      </aus:Authentication>`;
    }

    return `<mg:Authentication>
      <mg:ABN>${this.credentials.abn}</mg:ABN>
      <mg:DeviceId>${this.credentials.deviceId}</mg:DeviceId>
      <mg:AuthToken>${this.credentials.authToken}</mg:AuthToken>
    </mg:Authentication>`;
  }

  private parseResponse(response: SoapResponse): {
    body: Record<string, unknown>;
    fault?: SoapFault;
  } {
    const bodyContent = this.extractTag(response.body, ["soap:Body", "env:Body", "Body"]);
    if (!bodyContent) {
      throw new Error("Malformed SOAP response: Body missing");
    }

    const faultContent = this.extractTag(bodyContent, ["soap:Fault", "Fault"]);
    if (faultContent) {
      return {
        body: {},
        fault: {
          code: this.extractTagText(faultContent, ["faultcode", "code"]) ?? "UNKNOWN",
          message: this.extractTagText(faultContent, ["faultstring", "message"]) ?? "Unknown fault",
          detail: this.extractTag(faultContent, ["detail"]),
        },
      };
    }

    const operationMatch = bodyContent.match(/<([\w:]+)[^>]*>([\s\S]*)<\/\1>/);
    if (!operationMatch) {
      return { body: {} };
    }

    const operation = operationMatch[1];
    const payload = operationMatch[2];
    const parsedBody = this.parseChildren(payload);

    return {
      body: {
        [operation]: parsedBody,
      },
    };
  }

  private extractTag(source: string, tags: string[]): string | undefined {
    for (const tag of tags) {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i");
      const match = source.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private extractTagText(source: string, tags: string[]): string | undefined {
    const content = this.extractTag(source, tags);
    return content ? content.replace(/<[^>]+>/g, "").trim() : undefined;
  }

  private parseChildren(xml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const regex = /<([\w:]+)[^>]*>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml))) {
      const key = match[1];
      const inner = match[2].trim();
      const value = /<([\w:]+)[^>]*>/.test(inner) ? this.parseChildren(inner) : inner;

      if (result[key] === undefined) {
        result[key] = value;
      } else if (Array.isArray(result[key])) {
        (result[key] as unknown[]).push(value);
      } else {
        result[key] = [result[key], value];
      }
    }
    return result;
  }
}
