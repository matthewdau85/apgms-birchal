// Minimal fallback types that allow offline builds when Prisma client has not been generated yet.
declare module "@prisma/client" {
  export class PrismaClient {
    [key: string]: unknown;
  }
}
