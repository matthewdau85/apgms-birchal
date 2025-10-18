import { createLogger } from "../../../shared/src";

const logger = createLogger({ service: "audit" });

async function main() {
  logger.info("Service boot sequence started");
  logger.warn("No runtime behaviour defined for this service yet");
  logger.info("Service boot sequence completed");
}

main().catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.fatal("Service failed to start", err);
  process.exit(1);
});
