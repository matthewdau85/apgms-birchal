import { logger } from "../../../shared/src/logger";

const service = "cdr";

logger.info({ reqId: "cdr-startup", service }, "cdr service ready");
