import { describe, it, expect, beforeEach } from "./harness";
import fs from "node:fs";
import path from "node:path";
import { buildApp } from "../services/api-gateway/src/app";

const ADMIN_HEADERS = { "x-admin-token": "local-admin" };
const artifactsDir = path.resolve(process.cwd(), "artifacts/sbr");

function removeArtifacts() {
  if (fs.existsSync(artifactsDir)) {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
  }
}

describe("SBR AS4 stub", () => {
  beforeEach(() => {
    removeArtifacts();
  });

  it("writes outbound artifacts and lists inbound", async () => {
    const app = await buildApp();
    const sendResponse = await app.inject({
      method: "POST",
      url: "/sbr/send",
      headers: ADMIN_HEADERS,
      payload: { payload: { invoice: 1 } },
    });
    expect(sendResponse.statusCode).toBe(202);

    const outFiles = fs.readdirSync(path.join(artifactsDir, "out"));
    expect(outFiles.some((file) => file.endsWith(".json"))).toBe(true);

    const inboundDir = path.join(artifactsDir, "in");
    await fs.promises.mkdir(inboundDir, { recursive: true });
    const inboundPath = path.join(inboundDir, "test.json");
    await fs.promises.writeFile(
      inboundPath,
      JSON.stringify({ receipt: true }, null, 2),
    );

    const received = await app.inject({
      method: "GET",
      url: "/sbr/received",
      headers: ADMIN_HEADERS,
    });
    expect(received.statusCode).toBe(200);
    const payload = received.json();
    expect(payload.messageIds).toContain("test");

    await app.close();
  });
});
