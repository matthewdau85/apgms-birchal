import { describe, expect, it } from "vitest";
import { authCredentialsSchema, bankLineCreateSchema, paginationSchema } from "../src/schemas";

describe("bankLineCreateSchema", () => {
  it("parses and normalises valid payloads", () => {
    const result = bankLineCreateSchema.parse({
      orgId: " demo-org ",
      date: "2024-09-10",
      amount: "1,234.567",
      payee: "  Coffee Club  ",
      desc: " Monthly meetup ",
    });

    expect(result).toEqual({
      orgId: "demo-org",
      date: new Date("2024-09-10"),
      amount: 1234.57,
      payee: "Coffee Club",
      desc: "Monthly meetup",
    });
  });

  it("rejects non-numeric amounts", () => {
    const result = bankLineCreateSchema.safeParse({
      orgId: "demo-org",
      date: "2024-09-10",
      amount: "not-a-number",
      payee: "Vendor",
      desc: "Description",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Invalid amount");
    }
  });

  it("rejects invalid dates", () => {
    const result = bankLineCreateSchema.safeParse({
      orgId: "demo-org",
      date: "yesterday",
      amount: 10,
      payee: "Vendor",
      desc: "Description",
    });

    expect(result.success).toBe(false);
  });
});

describe("authCredentialsSchema", () => {
  it("requires a valid email and password", () => {
    const valid = authCredentialsSchema.safeParse({ email: "founder@example.com", password: "password123" });
    expect(valid.success).toBe(true);

    const invalid = authCredentialsSchema.safeParse({ email: "invalid", password: "short" });
    expect(invalid.success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("defaults to 20 when take is missing", () => {
    const parsed = paginationSchema.parse({});
    expect(parsed.take).toBe(20);
  });

  it("clamps the take value within bounds", () => {
    const low = paginationSchema.parse({ take: -5 });
    const high = paginationSchema.parse({ take: 999 });

    expect(low.take).toBe(1);
    expect(high.take).toBe(200);
  });
});
