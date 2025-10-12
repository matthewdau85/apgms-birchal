import { logger } from "../../shared/src/logger";

const service = "worker";

logger.info({ reqId: "worker-startup", service }, "worker ready");
