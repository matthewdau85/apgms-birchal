export { prisma } from "./db";

export function formatServiceTag(service: string): string {
  return `apgms:${service}`;
}
