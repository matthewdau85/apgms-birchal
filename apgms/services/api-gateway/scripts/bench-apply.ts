import { performance } from 'node:perf_hooks';

const REQUEST_COUNT = 200;
const ENDPOINT = 'http://localhost:3000/allocations/apply';

const payload = {
  source: 'bench',
  allocationId: 'bench',
  amount: 1,
};

type Result = {
  index: number;
  status: number;
  ok: boolean;
  durationMs: number;
};

async function runSequentialBenchmarks(): Promise<Result[]> {
  const results: Result[] = [];

  for (let i = 0; i < REQUEST_COUNT; i += 1) {
    const body = JSON.stringify({
      ...payload,
      request: i,
    });

    const start = performance.now();
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body,
      });

      const durationMs = performance.now() - start;
      results.push({
        index: i,
        status: response.status,
        ok: response.ok,
        durationMs,
      });

      // Drain body to avoid socket reuse issues.
      try {
        await response.arrayBuffer();
      } catch (consumeErr) {
        console.warn(`Response consume error (#${i}):`, consumeErr);
      }

      if (!response.ok) {
        console.warn(`Request #${i} failed with status ${response.status}`);
      }
    } catch (error) {
      const durationMs = performance.now() - start;
      results.push({
        index: i,
        status: -1,
        ok: false,
        durationMs,
      });
      console.error(`Request #${i} encountered an error:`, error);
    }
  }

  return results;
}

function percentile(sortedDurations: number[], percentile: number): number {
  if (sortedDurations.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedDurations.length - 1,
    Math.ceil(percentile * sortedDurations.length) - 1,
  );
  return sortedDurations[index];
}

(async () => {
  console.log(`Running ${REQUEST_COUNT} sequential POST requests to ${ENDPOINT}`);
  const results = await runSequentialBenchmarks();

  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const p50 = percentile(durations, 0.5);
  const p95 = percentile(durations, 0.95);

  console.log('--- Summary ---');
  console.log(`p50: ${p50.toFixed(2)} ms`);
  console.log(`p95: ${p95.toFixed(2)} ms`);
})();
