import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { test } from "node:test";
import Fastify from "fastify";

import { CENSOR, loggerOptions } from "../src/logger.js";

test("logger redacts sensitive fields", async () => {
  const lines: string[] = [];

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });

  const app = Fastify({
    logger: {
      ...loggerOptions,
      stream,
    },
  });

  const email = "founder@example.com";
  const token = "secret-token";
  const cookie = "session=abc";
  const databaseUrl = "postgres://user:pass@host/db";

  app.log.info(
    {
      email,
      nested: { email: "nested@example.com" },
      DATABASE_URL: databaseUrl,
      req: {
        headers: {
          authorization: `Bearer ${token}`,
          cookie,
          "set-cookie": cookie,
        },
        body: { email: "request@example.com", password: "super-secret" },
        params: { token: "param-token" },
        query: { search: "foo" },
      },
      res: {
        headers: { authorization: "Bearer res-token" },
        payload: { token: "response-token" },
      },
      token,
    },
    "sensitive log",
  );

  app.log.flush();

  assert.equal(lines.length, 1, "expected a single log line");

  const rawLog = lines[0];
  const entry = JSON.parse(rawLog);

  assert.equal(entry.email, CENSOR);
  assert.equal(entry.nested.email, CENSOR);
  assert.equal(entry.DATABASE_URL, CENSOR);
  assert.equal(entry.token, CENSOR);

  // Ensure sensitive values never reach the serialized log payload.
  assert.ok(!rawLog.includes(email), "email leaked into logs");
  assert.ok(!rawLog.includes(token), "token leaked into logs");
  assert.ok(!rawLog.includes(cookie), "cookie leaked into logs");
  assert.ok(!rawLog.includes(databaseUrl), "database url leaked into logs");

  await app.close();
});
