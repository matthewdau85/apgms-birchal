import { randomUUID } from "node:crypto";

class PrismaClient {
  constructor() {
    this.user = {
      findMany: async () => [],
    };

    this.bankLine = {
      findMany: async () => [],
      create: async ({ data } = {}) => ({
        id: randomUUID(),
        ...data,
      }),
    };
  }

  async $disconnect() {
    return undefined;
  }
}

export { PrismaClient };
export default PrismaClient;
