import { logger } from "../../../shared/src/logger";

const service = "registries";

logger.info({ reqId: "registries-startup", service }, "registries service ready");
