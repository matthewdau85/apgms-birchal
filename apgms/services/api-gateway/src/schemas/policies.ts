import { z } from "zod";

export const POLICY_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
  rules: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const POLICY_CREATE_SCHEMA = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  rules: z.array(z.string().min(1)).min(1),
});

export const POLICY_LIST_SCHEMA = z.object({
  items: z.array(POLICY_SCHEMA),
});
