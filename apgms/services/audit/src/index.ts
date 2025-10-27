import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

export type AuditEventKind = 'DISCREPANCY' | 'COMPLIANCE';
export type AuditEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AuditEventInput {
  kind: AuditEventKind;
  entityId: string;
  description: string;
  severity?: AuditEventSeverity;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  timestamp: Date;
  severity: AuditEventSeverity;
  metadata: Record<string, unknown>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface WebhookPayload {
  url: string;
  body: Record<string, unknown>;
}

export interface EmailClient {
  sendEmail(message: EmailMessage): Promise<void>;
}

export interface WebhookClient {
  sendWebhook(payload: WebhookPayload): Promise<void>;
}

export interface NotificationTargets {
  emails?: string[];
  webhooks?: string[];
}

export type NotificationRules = Partial<Record<AuditEventKind | 'ALL', NotificationTargets>>;

export interface NotificationDispatcherOptions {
  rules?: NotificationRules;
  emailClient?: EmailClient;
  webhookClient?: WebhookClient;
}

export class NotificationDispatcher {
  private readonly rules: NotificationRules;
  private readonly emailClient?: EmailClient;
  private readonly webhookClient?: WebhookClient;

  constructor(options: NotificationDispatcherOptions = {}) {
    this.rules = options.rules ?? {};
    this.emailClient = options.emailClient;
    this.webhookClient = options.webhookClient;
  }

  async notify(event: AuditEvent): Promise<void> {
    const targets = this.collectTargets(event.kind);

    await Promise.all([
      this.dispatchEmails(event, targets.emails ?? []),
      this.dispatchWebhooks(event, targets.webhooks ?? []),
    ]);
  }

  private collectTargets(kind: AuditEventKind): NotificationTargets {
    const universal = this.rules.ALL ?? {};
    const specific = this.rules[kind] ?? {};

    return {
      emails: [...new Set([...(universal.emails ?? []), ...(specific.emails ?? [])])],
      webhooks: [...new Set([...(universal.webhooks ?? []), ...(specific.webhooks ?? [])])],
    };
  }

  private async dispatchEmails(event: AuditEvent, recipients: string[]): Promise<void> {
    if (!this.emailClient || recipients.length === 0) {
      return;
    }

    const subject = `[${event.kind}] ${event.description}`;
    const body = JSON.stringify(
      {
        id: event.id,
        entityId: event.entityId,
        severity: event.severity,
        metadata: event.metadata,
        timestamp: event.timestamp.toISOString(),
      },
      null,
      2,
    );

    await Promise.all(
      recipients.map((to) => this.emailClient!.sendEmail({ to, subject, body })),
    );
  }

  private async dispatchWebhooks(event: AuditEvent, urls: string[]): Promise<void> {
    if (!this.webhookClient || urls.length === 0) {
      return;
    }

    const payload = {
      id: event.id,
      kind: event.kind,
      entityId: event.entityId,
      description: event.description,
      severity: event.severity,
      metadata: event.metadata,
      timestamp: event.timestamp.toISOString(),
    } satisfies Record<string, unknown>;

    await Promise.all(
      urls.map((url) => this.webhookClient!.sendWebhook({ url, body: payload })),
    );
  }
}

export interface AuditTrailArchiveOptions {
  archivePath: string;
  fileSystem?: typeof fs;
}

export class AuditTrailArchive {
  private readonly archivePath: string;
  private readonly fileSystem: typeof fs;

  constructor(options: AuditTrailArchiveOptions) {
    this.archivePath = options.archivePath;
    this.fileSystem = options.fileSystem ?? fs;
  }

  async append(event: AuditEvent): Promise<void> {
    await this.ensureDirectory();
    const serialised = JSON.stringify(this.serialise(event));
    await this.fileSystem.appendFile(this.archivePath, `${serialised}\n`);
  }

  async readAll(): Promise<AuditEvent[]> {
    try {
      const raw = await this.fileSystem.readFile(this.archivePath, 'utf8');
      return raw
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => this.deserialise(JSON.parse(line)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    await this.ensureDirectory();
    await this.fileSystem.writeFile(this.archivePath, '');
  }

  private serialise(event: AuditEvent): Record<string, unknown> {
    return {
      ...event,
      timestamp: event.timestamp.toISOString(),
    };
  }

  private deserialise(payload: Record<string, unknown>): AuditEvent {
    const { id, kind, entityId, description, metadata, severity, timestamp } = payload as {
      id: string;
      kind: AuditEventKind;
      entityId: string;
      description: string;
      metadata: Record<string, unknown>;
      severity: AuditEventSeverity;
      timestamp: string;
    };

    return {
      id,
      kind,
      entityId,
      description,
      metadata,
      severity,
      timestamp: new Date(timestamp),
    };
  }

  private async ensureDirectory(): Promise<void> {
    await this.fileSystem.mkdir(dirname(this.archivePath), { recursive: true });
  }
}

export interface AuditServiceOptions {
  archivePath?: string;
  notificationRules?: NotificationRules;
  emailClient?: EmailClient;
  webhookClient?: WebhookClient;
  fileSystem?: typeof fs;
}

export class AuditService {
  private readonly archive: AuditTrailArchive;
  private readonly dispatcher: NotificationDispatcher;
  private readonly events: AuditEvent[] = [];

  constructor(options: AuditServiceOptions = {}) {
    this.archive = new AuditTrailArchive({
      archivePath: options.archivePath ?? './audit-archive.log',
      fileSystem: options.fileSystem,
    });
    this.dispatcher = new NotificationDispatcher({
      rules: options.notificationRules,
      emailClient: options.emailClient,
      webhookClient: options.webhookClient,
    });
  }

  async ingest(event: AuditEventInput): Promise<AuditEvent> {
    const enriched: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      severity: event.severity ?? 'MEDIUM',
      metadata: event.metadata ?? {},
      kind: event.kind,
      entityId: event.entityId,
      description: event.description,
    };

    await this.archive.append(enriched);
    this.events.push(enriched);
    await this.dispatcher.notify(enriched);
    return enriched;
  }

  async recoverFromArchive(): Promise<AuditEvent[]> {
    const recovered = await this.archive.readAll();
    this.events.splice(0, this.events.length, ...recovered);
    return [...this.events];
  }

  getRecentEvents(): AuditEvent[] {
    return [...this.events];
  }

  async getArchivedEvents(): Promise<AuditEvent[]> {
    return this.archive.readAll();
  }
}

export class InMemoryEmailClient implements EmailClient {
  readonly messages: EmailMessage[] = [];

  async sendEmail(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

export class InMemoryWebhookClient implements WebhookClient {
  readonly payloads: WebhookPayload[] = [];

  async sendWebhook(payload: WebhookPayload): Promise<void> {
    this.payloads.push(payload);
  }
}
