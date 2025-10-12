import { logger } from "../../../shared/src/logger";

const service = "connectors";

logger.info({ reqId: "connectors-startup", service }, "connectors service ready");
