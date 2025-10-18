import { groupJobsByPriority } from "./job.js";

const sample = groupJobsByPriority([
  { id: "alpha", priority: 1 },
  { id: "beta", priority: 2 },
  { id: "gamma", priority: 1 },
]);

if (process.env.NODE_ENV !== "test") {
  console.log("worker boot", Array.from(sample.entries()));
}

export { groupJobsByPriority };
