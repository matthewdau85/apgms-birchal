import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { config } = await import("./config");
const { startTelemetry } = await import("./otel");
const loggingPlugin = (await import("./plugins/logging")).default;

const telemetry = await startTelemetry(config.telemetry.otlpEndpoint);

const [{ default: Fastify }, { default: cors }, sharedDb] = await Promise.all([
  import("fastify"),
  import("@fastify/cors"),
  import("../../../shared/src/db"),
]);
const { prisma } = sharedDb as typeof import("../../../shared/src/db");

const app = Fastify({
  logger: {
    level: config.logging.level,
  },
});

await app.register(loggingPlugin);

const allowedOrigins = config.http.allowedOrigins === true ? true : config.http.allowedOrigins;
await app.register(cors, { origin: allowedOrigins });

app.addHook("onClose", async () => {
  await telemetry.shutdown();
});

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

app.get("/bank-lines", async (req) => {
  const take = Number((req.query as Record<string, unknown>).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

app.post("/bank-lines", async (req, rep) => {
  try {
    const body = req.body as {
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
    };
    const amountValue =
      typeof body.amount === "string" ? Number.parseFloat(body.amount) : body.amount;
    if (Number.isNaN(amountValue)) {
      throw new Error("invalid_amount");
    }
    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: amountValue,
        payee: body.payee,
        desc: body.desc,
      },
    });
    return rep.code(201).send(created);
  } catch (error) {
    req.log.error(error);
    return rep.code(400).send({ error: "bad_request" });
  }
});

app.ready(() => {
  app.log.info(app.printRoutes());
});

const host = config.http.host;
const port = config.http.port;

app
  .listen({ port, host })
  .catch((err) => {
    app.log.error(err, "failed to start api-gateway");
    return telemetry.shutdown().finally(() => {
      process.exit(1);
    });
  });
