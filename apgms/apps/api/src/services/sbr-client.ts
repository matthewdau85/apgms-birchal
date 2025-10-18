import { randomUUID } from "node:crypto";
import type { AppConfig, SbrConfig } from "../config";
import { config as appConfig } from "../config";
import { prisma } from "@apgms/shared/src/db";

export type AuditBlobDirection = "request" | "response";

export interface AuditBlobInput {
  correlationId?: string;
  direction: AuditBlobDirection;
  endpoint: string;
  messageId: string;
  payload: string;
  payloadType: string;
}

export interface AuditBlobRepository {
  save(input: AuditBlobInput): Promise<void>;
}

export class PrismaAuditBlobRepository implements AuditBlobRepository {
  async save(input: AuditBlobInput): Promise<void> {
    await (prisma as unknown as { auditBlob: { create: (args: { data: unknown }) => Promise<void> } }).auditBlob.create({
      data: {
        correlationId: input.correlationId ?? null,
        direction: input.direction,
        endpoint: input.endpoint,
        messageId: input.messageId,
        payload: input.payload,
        payloadType: input.payloadType,
      },
    });
  }
}

export interface SubmitDocumentOptions {
  payload: string;
  correlationId?: string;
  conversationId?: string;
  documentType?: string;
}

export interface SubmitDocumentResult {
  messageId: string;
  conversationId: string;
  receipt: string;
  simulated: boolean;
}

export interface SbrClientDependencies {
  auditRepository?: AuditBlobRepository;
  fetchImpl?: typeof fetch;
  clock?: () => Date;
  uuid?: () => string;
  config?: AppConfig;
}

const SOAP_ENV = "http://schemas.xmlsoap.org/soap/envelope/";
const EBMS_NS = "http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/";
const WSSE_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
const WSU_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";

const defaultConfig = appConfig;

export class SbrClient {
  private readonly auditRepository: AuditBlobRepository;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => Date;
  private readonly uuid: () => string;
  private readonly config: AppConfig;

  constructor(deps: SbrClientDependencies = {}) {
    this.auditRepository = deps.auditRepository ?? new PrismaAuditBlobRepository();
    this.fetchImpl = deps.fetchImpl ?? fetch.bind(globalThis);
    this.clock = deps.clock ?? (() => new Date());
    this.uuid = deps.uuid ?? (() => randomUUID());
    this.config = deps.config ?? defaultConfig;
  }

  async submitDocument(options: SubmitDocumentOptions): Promise<SubmitDocumentResult> {
    const messageId = this.uuid();
    const conversationId = options.conversationId ?? messageId;
    const timestamp = this.clock().toISOString();
    const sbrConfig = this.config.sbr;

    const envelope = buildAs4Envelope({
      payload: options.payload,
      messageId,
      conversationId,
      timestamp,
      documentType: options.documentType ?? sbrConfig.service,
      sbr: sbrConfig,
    });

    await this.auditRepository.save({
      correlationId: options.correlationId ?? conversationId,
      direction: "request",
      endpoint: sbrConfig.endpoint,
      messageId,
      payload: envelope,
      payloadType: "application/soap+xml",
    });

    if (sbrConfig.mockResponses) {
      const simulated = buildSimulatedResponse({
        conversationId,
        messageId,
        timestamp,
        receiptId: this.uuid(),
        sbr: sbrConfig,
      });

      await this.auditRepository.save({
        correlationId: options.correlationId ?? conversationId,
        direction: "response",
        endpoint: sbrConfig.endpoint,
        messageId,
        payload: simulated.receipt,
        payloadType: "application/soap+xml",
      });

      return { ...simulated, simulated: true };
    }

    const response = await this.fetchImpl(sbrConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        Authorization: `Basic ${Buffer.from(`${sbrConfig.username}:${sbrConfig.password}`).toString("base64")}`,
      },
      body: envelope,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SBR gateway responded with ${response.status}: ${text}`);
    }

    const receipt = await response.text();

    await this.auditRepository.save({
      correlationId: options.correlationId ?? conversationId,
      direction: "response",
      endpoint: sbrConfig.endpoint,
      messageId,
      payload: receipt,
      payloadType: response.headers.get("content-type") ?? "application/soap+xml",
    });

    return {
      messageId,
      conversationId,
      receipt,
      simulated: false,
    };
  }
}

interface EnvelopeParams {
  payload: string;
  messageId: string;
  conversationId: string;
  timestamp: string;
  documentType: string;
  sbr: SbrConfig;
}

const escapeXml = (input: string): string =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildAs4Envelope = (params: EnvelopeParams): string => {
  const { payload, messageId, conversationId, timestamp, documentType, sbr } = params;
  const replyTo = sbr.replyTo ? `<eb:ReceiptReplyTo>${escapeXml(sbr.replyTo)}</eb:ReceiptReplyTo>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_ENV}" xmlns:eb="${EBMS_NS}" xmlns:wsse="${WSSE_NS}" xmlns:wsu="${WSU_NS}">
  <soap:Header>
    <eb:Messaging soap:mustUnderstand="true">
      <eb:UserMessage>
        <eb:MessageInfo>
          <eb:Timestamp>${timestamp}</eb:Timestamp>
          <eb:MessageId>${messageId}</eb:MessageId>
          <eb:RefToMessageId>${conversationId}</eb:RefToMessageId>
        </eb:MessageInfo>
        <eb:PartyInfo>
          <eb:From>
            <eb:PartyId>${escapeXml(sbr.fromPartyId)}</eb:PartyId>
          </eb:From>
          <eb:To>
            <eb:PartyId>${escapeXml(sbr.toPartyId)}</eb:PartyId>
          </eb:To>
        </eb:PartyInfo>
        <eb:CollaborationInfo>
          <eb:Service>${escapeXml(documentType)}</eb:Service>
          <eb:Action>${escapeXml(sbr.action)}</eb:Action>
          <eb:ConversationId>${conversationId}</eb:ConversationId>
        </eb:CollaborationInfo>
        <eb:PayloadInfo>
          <eb:PartInfo href="#payload">
            <eb:PartProperties>
              <eb:Property name="MimeType">application/xml</eb:Property>
            </eb:PartProperties>
          </eb:PartInfo>
        </eb:PayloadInfo>
        ${replyTo}
      </eb:UserMessage>
    </eb:Messaging>
    <wsse:Security soap:mustUnderstand="true">
      <wsu:Timestamp>
        <wsu:Created>${timestamp}</wsu:Created>
        <wsu:Expires>${new Date(new Date(timestamp).getTime() + 5 * 60_000).toISOString()}</wsu:Expires>
      </wsu:Timestamp>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <eb:PayloadData wsu:Id="payload">${payload}</eb:PayloadData>
  </soap:Body>
</soap:Envelope>`;
};

interface SimulatedResponseParams {
  conversationId: string;
  messageId: string;
  timestamp: string;
  receiptId: string;
  sbr: SbrConfig;
}

const buildSimulatedResponse = (params: SimulatedResponseParams): SubmitDocumentResult => {
  const { conversationId, messageId, timestamp, receiptId, sbr } = params;
  const receipt = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_ENV}" xmlns:eb="${EBMS_NS}">
  <soap:Header>
    <eb:Messaging>
      <eb:SignalMessage>
        <eb:MessageInfo>
          <eb:Timestamp>${timestamp}</eb:Timestamp>
          <eb:MessageId>${receiptId}</eb:MessageId>
          <eb:RefToMessageId>${messageId}</eb:RefToMessageId>
        </eb:MessageInfo>
        <eb:Receipt>
          <eb:MessageId>${messageId}</eb:MessageId>
          <eb:ConversationId>${conversationId}</eb:ConversationId>
          <eb:Status>ACCEPTED</eb:Status>
        </eb:Receipt>
      </eb:SignalMessage>
    </eb:Messaging>
  </soap:Header>
  <soap:Body>
    <eb:ReceiptAcknowledgement>Simulated response for ${escapeXml(sbr.endpoint)}</eb:ReceiptAcknowledgement>
  </soap:Body>
</soap:Envelope>`;

  return {
    messageId,
    conversationId,
    receipt,
    simulated: true,
  };
};

export const __private__ = {
  buildAs4Envelope,
  buildSimulatedResponse,
};
