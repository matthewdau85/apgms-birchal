const REQUEST_COUNT = 200;
const TARGET_URL = "http://localhost:3000/allocations/apply";

interface DurationStats {
  p50: number;
  p95: number;
}

const payload = {
  amount: 1,
  currency: "AUD",
  metadata: { source: "perf-harness" },
};

async function main(): Promise<void> {
  const durations: number[] = [];

  for (let i = 0; i < REQUEST_COUNT; i += 1) {
    const start = performance.now();
    const response = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const elapsed = performance.now() - start;
    durations.push(elapsed);

    if (!response.ok) {
      const bodyText = await safeReadBody(response);
      throw new Error(`Request ${i + 1} failed: ${response.status} ${response.statusText} - ${bodyText}`);
    }

    // Consume body to avoid resource leaks.
    await safeReadBody(response);
  }

  const stats = calculateStats(durations);

  console.log(`Completed ${REQUEST_COUNT} sequential requests to ${TARGET_URL}`);
  console.log(`p50: ${stats.p50.toFixed(2)}ms`);
  console.log(`p95: ${stats.p95.toFixed(2)}ms`);
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `<<unreadable body: ${error}>>`;
  }
}

function calculateStats(samples: number[]): DurationStats {
  if (samples.length === 0) {
    return { p50: 0, p95: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);

  return { p50, p95 };
}

function percentile(sortedSamples: number[], ratio: number): number {
  if (sortedSamples.length === 0) {
    return 0;
  }

  const index = Math.floor(ratio * (sortedSamples.length - 1));
  return sortedSamples[index];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
