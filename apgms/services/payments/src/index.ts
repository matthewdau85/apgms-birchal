import { logger } from "../../../shared/src/logger";

const service = "payments";

logger.info({ reqId: "payments-startup", service }, "payments service ready");
