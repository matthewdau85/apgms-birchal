import { describe, expect, test } from "../../scripts/testing";
import { groupJobsByPriority } from "../src/job";

describe("groupJobsByPriority", () => {
  test("groups jobs by numeric priority", () => {
    const grouped = groupJobsByPriority([
      { id: "a", priority: 1 },
      { id: "b", priority: 2 },
      { id: "c", priority: 1 },
    ]);

    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(2)).toHaveLength(1);
  });
});
