import { afterEach, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/index";

describe("org scope hook", () => {
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

  it("rejects cross-org access", async () => {
    const token = await app.jwt.sign({ sub: "user-1", orgId: "orgA" });

    const response = await supertest(app)
      .get("/v1/orgs/otherOrg/resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ code: "FORBIDDEN" });
  });

  it("allows matching org access", async () => {
    const token = await app.jwt.sign({ sub: "user-1", orgId: "orgA" });

    const response = await supertest(app)
      .get("/v1/orgs/orgA/resource")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ orgId: "orgA" });
  });
});
