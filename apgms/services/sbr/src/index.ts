import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import dotenv from "dotenv";
import Fastify from "fastify";

import { filenames, paths, send } from "./as4/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "sbr" }));

app.post("/sbr/send", async (req, rep) => {
  try {
    const body = req.body as {
      payload: unknown;
      action?: string;
      orgId?: string;
    };

    if (!body || typeof body !== "object") {
      return rep.code(400).send({ error: "invalid_request" });
    }

    const action = body.action ?? "";
    const orgId = body.orgId ?? "";

    if (!action || !orgId) {
      return rep.code(400).send({ error: "action_and_org_required" });
    }

    const result = await send(body.payload, { action, orgId });

    const messageDir = path.join(paths.base, result.messageId);
    const [requestXml, receiptXml, signaturesRaw] = await Promise.all([
      fs.readFile(path.join(messageDir, filenames.request), "utf8"),
      fs.readFile(path.join(messageDir, filenames.receipt), "utf8"),
      fs.readFile(path.join(messageDir, filenames.signatures), "utf8"),
    ]);

    return {
      ...result,
      files: {
        request: requestXml,
        receipt: receiptXml,
        signatures: JSON.parse(signaturesRaw),
      },
    };
  } catch (error) {
    req.log.error(error);
    return rep.code(500).send({ error: "send_failed" });
  }
});

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
