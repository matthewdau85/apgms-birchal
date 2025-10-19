const port = process.env.PORT || 3000;
const url = `http://127.0.0.1:${port}/health`;

const controller = new AbortController();
const timeout = setTimeout(() => {
  controller.abort();
}, 5000);

async function main() {
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.error(`Healthcheck request failed with status ${response.status}`);
      process.exit(1);
    }
    const data = await response.json().catch(() => null);
    if (!data || data.ok !== true) {
      console.error("Healthcheck response missing ok: true");
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Healthcheck timed out");
    } else {
      console.error("Healthcheck error", error);
    }
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

main();
