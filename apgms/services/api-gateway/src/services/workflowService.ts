import { FastifyBaseLogger } from "fastify";
import { AuditConnector } from "../connectors/auditConnector";
import { ServiceError } from "../utils/errors";
import { AuthenticatedUser } from "../types/auth";
import { BankLineService, CreateBankLineInput, BankLine } from "./bankLineService";

export class WorkflowService {
  constructor(
    private readonly bankLineService: BankLineService,
    private readonly auditConnector: AuditConnector,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async listBankLines(limit: number) {
    return this.bankLineService.listLatest(limit);
  }

  async createBankLine(input: CreateBankLineInput, actor: AuthenticatedUser): Promise<BankLine> {
    const line = await this.bankLineService.createLine(input);
    try {
      await this.auditConnector.record({
        event: "bank_line.created",
        data: {
          lineId: line.id,
          orgId: line.orgId,
          amount: line.amount,
        },
        actor: {
          id: actor.sub,
          email: actor.email,
        },
      });
    } catch (error) {
      this.logger.error({ err: error, lineId: line.id }, "Failed to orchestrate audit workflow");
      throw new ServiceError("workflow_error", "Bank line created but workflow orchestration failed", 502, {
        lineId: line.id,
      });
    }

    return line;
  }
}
