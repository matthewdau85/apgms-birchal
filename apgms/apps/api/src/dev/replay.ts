import { SbrClient } from "../services/sbr-client";
import { config } from "../config";

const samplePayload = `<Ping>
  <Message>Developer replay payload</Message>
</Ping>`;

async function main(): Promise<void> {
  const client = new SbrClient();
  const result = await client.submitDocument({ payload: samplePayload });

  console.log("SBR dev replay complete:");
  console.log(JSON.stringify({
    endpoint: config.sbr.endpoint,
    messageId: result.messageId,
    conversationId: result.conversationId,
    simulated: result.simulated,
  }, null, 2));
}

main().catch((error) => {
  console.error("Replay failed", error);
  process.exitCode = 1;
});
