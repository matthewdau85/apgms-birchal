import crypto from "node:crypto";

export interface EnvelopeOptions {
  orgId: string;
  docType: string;
  payload: string;
  receiverPartyId?: string;
  receiverRole?: string;
  service?: string;
  action?: string;
  messageId?: string;
  timestamp?: string;
}

export interface EnvelopeResult {
  messageId: string;
  timestamp: string;
  envelopeXml: string;
  userMessageCanonical: string;
  receiverPartyId: string;
  receiverRole: string;
  service: string;
  action: string;
}

const XML_HEADER = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>";
const DEFAULT_RECEIVER_PARTY_ID = "urn:gov:au:sbr:receiver";
const DEFAULT_RECEIVER_ROLE = "http://docs.oasis-open.org/ebxml-msg/role/receiver";
const DEFAULT_SERVICE = "SBR_PLACEHOLDER_SERVICE";
const DEFAULT_ACTION = "SBR_PLACEHOLDER_ACTION";
const PARTY_ID_TYPE = "urn:oasis:names:tc:ebcore:partyid-type:unregistered";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUserMessage(options: Required<Pick<EnvelopeOptions, "orgId" | "docType" | "payload" | "receiverPartyId" | "receiverRole" | "service" | "action" | "messageId" | "timestamp">>): string {
  const encodedPayload = Buffer.from(options.payload, "utf8").toString("base64");

  return [
    `<eb:UserMessage messageId="${options.messageId}" mpc="http://docs.oasis-open.org/ebxml-msg/mpc/default">`,
    `<eb:PartyInfo>`,
    `<eb:From><eb:PartyId type="${PARTY_ID_TYPE}">${escapeXml(options.orgId)}</eb:PartyId><eb:Role>http://docs.oasis-open.org/ebxml-msg/role/sender</eb:Role></eb:From>`,
    `<eb:To><eb:PartyId type="${PARTY_ID_TYPE}">${escapeXml(options.receiverPartyId)}</eb:PartyId><eb:Role>${escapeXml(options.receiverRole)}</eb:Role></eb:To>`,
    `</eb:PartyInfo>`,
    `<eb:CollaborationInfo>`,
    `<eb:Service type="${PARTY_ID_TYPE}">${escapeXml(options.service)}</eb:Service>`,
    `<eb:Action>${escapeXml(options.action)}</eb:Action>`,
    `<eb:ConversationId>${escapeXml(options.docType)}</eb:ConversationId>`,
    `<eb:AgreementRef type="docType">${escapeXml(options.docType)}</eb:AgreementRef>`,
    `</eb:CollaborationInfo>`,
    `<eb:MessageProperties>`,
    `<eb:Property name="OriginalSender">${escapeXml(options.orgId)}</eb:Property>`,
    `<eb:Property name="OriginalDocumentType">${escapeXml(options.docType)}</eb:Property>`,
    `<eb:Property name="CreationTimestamp">${options.timestamp}</eb:Property>`,
    `</eb:MessageProperties>`,
    `<eb:PayloadInfo>`,
    `<eb:PartInfo href="cid:payload">`,
    `<eb:PartProperties>`,
    `<eb:Property name="MimeType">application/xml</eb:Property>`,
    `<eb:Property name="Content-Transfer-Encoding">base64</eb:Property>`,
    `</eb:PartProperties>`,
    `<eb:DataHandler xml:lang="en">${encodedPayload}</eb:DataHandler>`,
    `</eb:PartInfo>`,
    `</eb:PayloadInfo>`,
    `</eb:UserMessage>`,
  ].join("");
}

export function buildEnvelope(options: EnvelopeOptions): EnvelopeResult {
  const receiverPartyId = options.receiverPartyId ?? DEFAULT_RECEIVER_PARTY_ID;
  const receiverRole = options.receiverRole ?? DEFAULT_RECEIVER_ROLE;
  const service = options.service ?? DEFAULT_SERVICE;
  const action = options.action ?? DEFAULT_ACTION;
  const messageId = options.messageId ?? `urn:uuid:${crypto.randomUUID()}`;
  const timestamp = options.timestamp ?? new Date().toISOString();

  const canonicalUserMessage = buildUserMessage({
    orgId: options.orgId,
    docType: options.docType,
    payload: options.payload,
    receiverPartyId,
    receiverRole,
    service,
    action,
    messageId,
    timestamp,
  });

  const envelopeXml = [
    XML_HEADER,
    `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:eb="http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/" xmlns:sbr="urn:gov:au:sbr:payload">`,
    `<soap:Header>`,
    `<eb:Messaging soap:mustUnderstand="true">`,
    canonicalUserMessage,
    `</eb:Messaging>`,
    `</soap:Header>`,
    `<soap:Body>`,
    `<sbr:Document>`,
    `<sbr:PayloadEncoding>base64</sbr:PayloadEncoding>`,
    `<sbr:PayloadReference>cid:payload</sbr:PayloadReference>`,
    `</sbr:Document>`,
    `</soap:Body>`,
    `</soap:Envelope>`,
  ].join("");

  return {
    messageId,
    timestamp,
    envelopeXml,
    userMessageCanonical: canonicalUserMessage,
    receiverPartyId,
    receiverRole,
    service,
    action,
  };
}
