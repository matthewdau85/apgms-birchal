import { logger } from "../../../shared/src/logger";

const service = "recon";

logger.info({ reqId: "recon-startup", service }, "recon service ready");
