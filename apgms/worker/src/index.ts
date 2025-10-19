import { runRedactionJob } from "./jobs/redact";

const main = async () => {
  const count = await runRedactionJob();
  console.log(`redaction job updated ${count} org(s)`);
};

await main().catch((err) => {
  console.error("redaction job failed", err);
  process.exitCode = 1;
});
