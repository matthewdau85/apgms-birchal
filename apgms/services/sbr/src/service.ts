import { randomUUID } from "node:crypto";
import {
  As4Client,
  As4Envelope,
  DetachedSignature,
  createBasEnvelope,
  signEnvelope,
} from "./as4.js";
import {
  AuditBlobKind,
  AuditBlobRepository,
  AuditBlobScope,
  AuditBlobRecord,
  InMemoryAuditBlobRepository,
  evaluateIntegrity,
} from "./audit-blob.js";

type BasArtifactKind = Extract<AuditBlobKind, "request" | "receipt">;

const BAS_SCOPE: AuditBlobScope = "sbr.bas";

export interface BasSubmissionRecord {
  id: string;
  orgId: string;
  period: string;
  requestBlobId: string;
  receiptBlobId: string;
  createdAt: Date;
  envelope: As4Envelope;
  signature: DetachedSignature;
}

export interface BasArtifactView {
  kind: BasArtifactKind;
  blobId: string;
  payload: string;
  sha256: string;
  integrity: ReturnType<typeof evaluateIntegrity>;
}

export interface BasSubmissionDetail {
  id: string;
  orgId: string;
  period: string;
  createdAt: Date;
  artifacts: Record<BasArtifactKind, BasArtifactView>;
}

export interface SubmitBasOptions {
  orgId: string;
  period: string;
  payload?: Record<string, unknown>;
}

export interface SbrServiceDependencies {
  auditRepo?: AuditBlobRepository;
  as4Client?: As4Client;
  signingKeyPem: string;
}

export class SbrService {
  private readonly auditRepo: AuditBlobRepository;
  private readonly as4Client: As4Client;
  private readonly signingKeyPem: string;
  private readonly submissions = new Map<string, BasSubmissionRecord>();

  constructor(deps: SbrServiceDependencies) {
    this.auditRepo = deps.auditRepo ?? new InMemoryAuditBlobRepository();
    this.as4Client =
      deps.as4Client ??
      new (class implements As4Client {
        async send(envelope: As4Envelope, signature: DetachedSignature) {
          return {
            messageId: envelope.messageId,
            receivedAt: new Date().toISOString(),
            raw: {
              status: "ACCEPTED",
              echoSignature: signature.value,
            },
          };
        }
      })();
    this.signingKeyPem = deps.signingKeyPem;
  }

  async submitBAS(options: SubmitBasOptions): Promise<BasSubmissionRecord> {
    const submissionId = randomUUID();
    const envelopePayload = {
      formType: "BAS",
      orgId: options.orgId,
      period: options.period,
      ...(options.payload ?? {}),
    };
    const envelope = createBasEnvelope(envelopePayload);
    const signature = signEnvelope(envelope, this.signingKeyPem);

    const requestPayload = JSON.stringify({ envelope, signature });
    const requestBlob = await this.auditRepo.create({
      scope: BAS_SCOPE,
      referenceId: submissionId,
      kind: "request",
      payload: requestPayload,
    });

    const receipt = await this.as4Client.send(envelope, signature);
    const receiptPayload = JSON.stringify(receipt);
    const receiptBlob = await this.auditRepo.create({
      scope: BAS_SCOPE,
      referenceId: submissionId,
      kind: "receipt",
      payload: receiptPayload,
    });

    const record: BasSubmissionRecord = {
      id: submissionId,
      orgId: options.orgId,
      period: options.period,
      requestBlobId: requestBlob.id,
      receiptBlobId: receiptBlob.id,
      createdAt: new Date(),
      envelope,
      signature,
    };
    this.submissions.set(record.id, record);
    return record;
  }

  async getSubmissionDetail(id: string): Promise<BasSubmissionDetail | null> {
    const record = this.submissions.get(id);
    if (!record) {
      return null;
    }
    const [requestBlob, receiptBlob] = await Promise.all([
      this.auditRepo.findById(record.requestBlobId),
      this.auditRepo.findById(record.receiptBlobId),
    ]);
    if (!requestBlob || !receiptBlob) {
      throw new Error("Submission artifacts missing");
    }

    return {
      id: record.id,
      orgId: record.orgId,
      period: record.period,
      createdAt: record.createdAt,
      artifacts: {
        request: this.toArtifactView("request", requestBlob),
        receipt: this.toArtifactView("receipt", receiptBlob),
      },
    };
  }

  private toArtifactView(kind: BasArtifactKind, blob: AuditBlobRecord): BasArtifactView {
    return {
      kind,
      blobId: blob.id,
      payload: blob.payload,
      sha256: blob.sha256,
      integrity: evaluateIntegrity(blob),
    };
  }
}
