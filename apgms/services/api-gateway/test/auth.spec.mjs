import { afterEach, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/index";

describe("authentication", () => {
  let app;

  beforeEach(async () => {
    process.env.JWT_SECRET = "dev-secret";
    process.env.JWT_ISSUER = "apgms";
    process.env.JWT_AUDIENCE = "apgms-clients";

    app = await createApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects missing Authorization header", async () => {
    const response = await supertest(app).get("/v1/ping");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED" });
  });

  it("rejects invalid token", async () => {
    const response = await supertest(app)
      .get("/v1/ping")
      .set("Authorization", "Bearer bad-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED" });
  });

  it("accepts a valid token", async () => {
    const token = await app.jwt.sign({
      sub: "user-1",
      orgId: "orgA",
      roles: ["admin"],
    });

    const response = await supertest(app)
      .get("/v1/ping")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      pong: true,
      user: {
        id: "user-1",
        orgId: "orgA",
        roles: ["admin"],
      },
    });
  });
});
