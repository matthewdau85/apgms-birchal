import { FastifyInstance } from "fastify";
import { prisma } from "../../../../shared/src/db";
import { validateBody, validateQuery, validateReply } from "../middleware/validate";
import {
  BankLineResp,
  CreateBankLineBody,
  ListBankLinesQuery,
  ListBankLinesResp,
  type BankLineRespOutput,
  type ListBankLinesRespOutput,
} from "../schemas/bank-lines";

const defaultTake = 20;

const centsToDecimalString = (value: number) => (value / 100).toFixed(2);

const toAmountCents = (value: unknown): number => {
  const asString =
    typeof value === "string"
      ? value
      : value !== null && typeof value === "object" && "toString" in value
        ? value.toString()
        : String(value ?? "0");
  const numeric = Number.parseFloat(asString);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.round(Math.abs(numeric) * 100);
};

type BankLineRecord = Awaited<ReturnType<typeof prisma.bankLine.create>>;

const toBankLineResponse = (line: BankLineRecord): BankLineRespOutput => ({
  id: line.id,
  orgId: line.orgId,
  date: line.date.toISOString(),
  amountCents: toAmountCents(line.amount),
  payee: line.payee,
  desc: line.desc,
  createdAt: line.createdAt.toISOString(),
});

export const registerBankLineRoutes = (app: FastifyInstance) => {
  app.get("/bank-lines", async (req, rep) => {
    const query = validateQuery(ListBankLinesQuery)(req);
    const take = query.take ?? defaultTake;
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });
    const payload: ListBankLinesRespOutput = { lines: lines.map(toBankLineResponse) };
    const response = validateReply(ListBankLinesResp)(payload);
    return rep.send(response);
  });

  app.post("/bank-lines", async (req, rep) => {
    const body = validateBody(CreateBankLineBody)(req);
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: centsToDecimalString(body.amountCents),
        payee: body.payee,
        desc: body.desc,
      },
    });
    const response = validateReply(BankLineResp)(toBankLineResponse(created));
    return rep.status(200).send(response);
  });
};
