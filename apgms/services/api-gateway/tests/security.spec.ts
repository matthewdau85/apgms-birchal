import Fastify from "fastify";
import securityPlugin from "../src/plugins/security";

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const withApp = async (fn: (app: ReturnType<typeof Fastify>) => Promise<void>) => {
  const app = Fastify({ logger: false });
  await app.register(async (instance) => {
    await instance.register(securityPlugin);
    instance.get("/ping", async () => ({ ok: true }));
    instance.post("/ping", async () => ({ ok: true }));
  });

  try {
    await fn(app);
  } finally {
    await app.close();
  }
};

const tests: TestCase[] = [
  {
    name: "allows preflight requests from allowed origins",
    run: async () => {
      process.env.CORS_ALLOWLIST = "https://allowed.test";
      process.env.RATE_LIMIT_RPM = "5";
      process.env.BODY_LIMIT_KB = "1";

      await withApp(async (app) => {
        const response = await app.inject({
          method: "OPTIONS",
          url: "/ping",
          headers: {
            origin: "https://allowed.test",
            "access-control-request-method": "GET",
          },
        });

        assert(response.statusCode === 200, `Expected 200 got ${response.statusCode}`);
        assert(
          response.headers["access-control-allow-origin"] === "https://allowed.test",
          "Missing allow origin header",
        );
      });
    },
  },
  {
    name: "blocks requests from disallowed origins",
    run: async () => {
      process.env.CORS_ALLOWLIST = "https://allowed.test";
      process.env.RATE_LIMIT_RPM = "5";
      process.env.BODY_LIMIT_KB = "1";

      await withApp(async (app) => {
        const response = await app.inject({
          method: "OPTIONS",
          url: "/ping",
          headers: {
            origin: "https://blocked.test",
            "access-control-request-method": "GET",
          },
        });

        assert(response.statusCode === 403, `Expected 403 got ${response.statusCode}`);
      });
    },
  },
  {
    name: "enforces rate limiting",
    run: async () => {
      process.env.CORS_ALLOWLIST = "https://allowed.test";
      process.env.RATE_LIMIT_RPM = "5";
      process.env.BODY_LIMIT_KB = "1";

      await withApp(async (app) => {
        const responses = [] as Awaited<ReturnType<typeof app.inject>>[];

        for (let i = 0; i < 6; i += 1) {
          responses.push(
            await app.inject({
              method: "GET",
              url: "/ping",
              headers: {
                origin: "https://allowed.test",
                "x-forwarded-for": "1.1.1.1",
              },
            }),
          );
        }

        const successCount = responses.filter((res) => res.statusCode === 200).length;
        const limitedCount = responses.filter((res) => res.statusCode === 429).length;
        assert(successCount > 0, "Expected at least one successful response");
        assert(limitedCount > 0, "Expected at least one rate limited response");
      });
    },
  },
  {
    name: "rejects payloads exceeding the body limit",
    run: async () => {
      process.env.CORS_ALLOWLIST = "https://allowed.test";
      process.env.RATE_LIMIT_RPM = "5";
      process.env.BODY_LIMIT_KB = "1";

      await withApp(async (app) => {
        const response = await app.inject({
          method: "POST",
          url: "/ping",
          headers: {
            origin: "https://allowed.test",
            "content-type": "text/plain",
          },
          payload: "x".repeat(2 * 1024),
        });

        assert(response.statusCode === 413, `Expected 413 got ${response.statusCode}`);
      });
    },
  },
];

const run = async () => {
  let hasFailure = false;

  for (const test of tests) {
    try {
      await test.run();
      console.log(`ok - ${test.name}`);
    } catch (error) {
      hasFailure = true;
      console.error(`not ok - ${test.name}`);
      console.error(error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
};

run();
