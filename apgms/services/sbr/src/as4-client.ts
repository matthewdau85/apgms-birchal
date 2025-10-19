import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface As4Attachment {
  name: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendMessageOptions {
  messageId?: string;
  orgId?: string;
  metadata?: Record<string, unknown> | undefined;
  attachments?: As4Attachment[] | undefined;
}

export interface SendMessageResult {
  messageId: string;
  artifactDir: string;
}

const ARTIFACTS_ENV_KEY = "SBR_ARTIFACTS_DIR";

function getArtifactsRoot(): string {
  const envDir = process.env[ARTIFACTS_ENV_KEY];
  if (envDir && envDir.trim().length > 0) {
    return path.resolve(envDir);
  }
  return path.resolve(process.cwd(), "artifacts", "sbr");
}

function sanitizeAttachmentName(name: string, index: number): string {
  const base = path.basename(name);
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (index === 0) {
    return safe;
  }
  const ext = path.extname(safe);
  const withoutExt = safe.slice(0, safe.length - ext.length);
  return `${withoutExt || "attachment"}-${index}${ext}`;
}

export async function sendMessage(
  payloadXml: string,
  options: SendMessageOptions = {},
): Promise<SendMessageResult> {
  const messageId = options.messageId ?? randomUUID();
  const artifactsRoot = getArtifactsRoot();
  const artifactDir = path.join(artifactsRoot, messageId);

  await fs.mkdir(artifactDir, { recursive: true });

  const payloadPath = path.join(artifactDir, "payload.xml");
  await fs.writeFile(payloadPath, payloadXml, "utf8");

  const attachments = options.attachments ?? [];
  const attachmentRecords: Array<{
    name: string;
    originalName: string;
    contentType?: string;
  }> = [];

  if (attachments.length > 0) {
    const attachmentsDir = path.join(artifactDir, "attachments");
    await fs.mkdir(attachmentsDir, { recursive: true });

    for (let i = 0; i < attachments.length; i += 1) {
      const attachment = attachments[i];
      const safeName = sanitizeAttachmentName(attachment.name, i);
      attachmentRecords.push({
        name: safeName,
        originalName: attachment.name,
        contentType: attachment.contentType,
      });

      const filePath = path.join(attachmentsDir, safeName);
      await fs.writeFile(filePath, attachment.content);
    }
  }

  const manifest = {
    messageId,
    orgId: options.orgId ?? null,
    createdAt: new Date().toISOString(),
    metadata: options.metadata ?? null,
    attachments: attachmentRecords,
  } satisfies Record<string, unknown>;

  const manifestPath = path.join(artifactDir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  return { messageId, artifactDir };
}
