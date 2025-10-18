import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServer } from "./app";
import { SoapClient } from "./clients";
import { loadConfig } from "./config";
import { BasSubmissionHandler, PayrollSubmissionHandler } from "./handlers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const config = loadConfig();
const soapClient = new SoapClient({
  endpoint: config.endpoint,
  productId: config.productId,
  credentials: config.credentials,
});

const app = createServer({
  basHandler: new BasSubmissionHandler({ client: soapClient }),
  payrollHandler: new PayrollSubmissionHandler({ client: soapClient }),
});

const port = Number(process.env.PORT ?? 3010);
const host = "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port }, "SBR service listening");
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
