import { PrismaClient } from "@prisma/client";
import { prismaQueryDuration, prismaQueryErrors } from "./metrics";

export const prisma = new PrismaClient();

prisma.$use(async (params: any, next: (params: any) => Promise<unknown>) => {
  const model = params.model ?? "raw";
  const action = params.action ?? "unknown";
  const stopTimer = prismaQueryDuration.startTimer({
    model,
    action,
    status: "inflight",
  });

  try {
    const result = await next(params);
    stopTimer({ model, action, status: "success" });
    return result;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "unknown";
    prismaQueryErrors.inc({ model, action, error_name: errorName });
    stopTimer({ model, action, status: "error" });
    throw error;
  }
});
