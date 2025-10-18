import { FastifyBaseLogger } from "fastify";
import { Connectors } from "../connectors";
import { PrismaLike, ServiceContext } from "./types";
import { UserService } from "./userService";
import { BankLineService } from "./bankLineService";
import { WorkflowService } from "./workflowService";

export interface Services {
  userService: UserService;
  bankLineService: BankLineService;
  workflowService: WorkflowService;
}

export interface ServiceOverrides {
  userService?: UserService;
  bankLineService?: BankLineService;
  workflowService?: WorkflowService;
  prisma?: PrismaLike;
}

let cachedPrisma: PrismaLike | null = null;

const loadDefaultPrisma = async (): Promise<PrismaLike> => {
  if (cachedPrisma) {
    return cachedPrisma;
  }

  try {
    const mod = await import("@apgms/shared/src/db");
    cachedPrisma = mod.prisma as unknown as PrismaLike;
    return cachedPrisma;
  } catch (error) {
    throw new Error("Prisma client is not available. Provide a prisma override for the API gateway services.");
  }
};

export const createServices = async (
  connectors: Connectors,
  logger: FastifyBaseLogger,
  overrides: ServiceOverrides = {},
): Promise<Services> => {
  const prisma: PrismaLike = overrides.prisma ?? (await loadDefaultPrisma());

  const userService = overrides.userService ?? new UserService(prisma, logger);
  const bankLineService = overrides.bankLineService ?? new BankLineService(prisma, logger);
  const workflowService =
    overrides.workflowService ?? new WorkflowService(bankLineService, connectors.audit, logger);

  return {
    userService,
    bankLineService,
    workflowService,
  };
};

export type { ServiceContext };
