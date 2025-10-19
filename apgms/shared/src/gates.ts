import { prisma } from "./db";

export type GateStatus = "OPEN" | "CLOSED";

export async function getGateStatus(gateId: string): Promise<GateStatus> {
  const record = await prisma.gateState.findUnique({ where: { gateId } });
  return (record?.status as GateStatus) ?? "CLOSED";
}

export async function setGateStatus(gateId: string, status: GateStatus) {
  await prisma.gateState.upsert({
    where: { gateId },
    create: { gateId, status },
    update: { status },
  });
}

export async function isGateOpen(gateId: string) {
  return (await getGateStatus(gateId)) === "OPEN";
}
