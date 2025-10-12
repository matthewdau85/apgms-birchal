import { logger } from "../../../shared/src/logger";

const service = "sbr";

logger.info({ reqId: "sbr-startup", service }, "sbr service ready");
