import { logger } from "../../shared/src/logger";

const app = "webapp";

logger.info({ reqId: "webapp-startup", app }, "webapp ready");
