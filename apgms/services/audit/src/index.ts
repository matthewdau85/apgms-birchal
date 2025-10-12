import { logger } from "../../../shared/src/logger";

const service = "audit";

logger.info({ reqId: "audit-startup", service }, "audit service ready");
