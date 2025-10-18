import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

const datamodel = Prisma.dmmf.datamodel;

const getModel = (name: string) =>
  datamodel.models.find((model) => model.name === name);

const getEnum = (name: string) =>
  datamodel.enums.find((enumeration) => enumeration.name === name);

describe("shared prisma schema", () => {
  it("exposes extended compliance models", () => {
    const requiredModels = [
      "DesignatedAccount",
      "ObligationSnapshot",
      "SettlementInstruction",
      "DiscrepancyEvent",
      "ComplianceDocument",
    ];

    for (const modelName of requiredModels) {
      const model = getModel(modelName);
      expect(model, `${modelName} model is missing`).toBeDefined();
    }
  });

  it("applies domain specific enumerations", () => {
    const accountStatus = getEnum("AccountStatus");
    expect(accountStatus?.values.map((value) => value.name)).toEqual([
      "ACTIVE",
      "SUSPENDED",
      "CLOSED",
    ]);

    const settlementStatus = getEnum("SettlementStatus");
    expect(settlementStatus?.values.map((value) => value.name)).toEqual([
      "PENDING",
      "SENT",
      "SETTLED",
      "FAILED",
    ]);

    const discrepancySeverity = getEnum("DiscrepancySeverity");
    expect(discrepancySeverity?.values.map((value) => value.name)).toEqual([
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ]);
  });

  it("links settlement instructions to designated accounts and discrepancies", () => {
    const settlementInstruction = getModel("SettlementInstruction");
    expect(settlementInstruction?.fields.map((field) => field.name)).toEqual(
      expect.arrayContaining([
        "designatedAccountId",
        "designatedAccount",
        "discrepancies",
      ]),
    );
  });
});
