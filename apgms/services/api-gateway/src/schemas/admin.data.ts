import { z } from "zod";

export const subjectDataExportRequestSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
});

const orgSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
});

const relationshipsSchema = z.object({
  bankLinesCount: z.number().int(),
});

export const subjectDataExportResponseSchema = z.object({
  org: orgSchema,
  user: userSchema,
  relationships: relationshipsSchema,
  exportedAt: z.string(),
});

export type SubjectDataExportRequest = z.infer<
  typeof subjectDataExportRequestSchema
>;

export type SubjectDataExportResponse = z.infer<
  typeof subjectDataExportResponseSchema
>;
