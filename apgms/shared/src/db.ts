type AsyncFn = (...args: any[]) => Promise<any>;

const createDelegate = (model: string, methods: string[]): Record<string, AsyncFn> => {
  const entries = methods.map((method) => [method, (..._args: any[]) => Promise.reject(new Error(`${model}.${method} is not implemented`))]);
  return Object.fromEntries(entries) as Record<string, AsyncFn>;
};

class FakePrismaClient {
  org = createDelegate("org", ["findUnique"]);
  user = createDelegate("user", ["findMany"]);
  bankLine = createDelegate("bankLine", ["findMany", "aggregate", "create"]);
  allocation = createDelegate("allocation", ["findMany", "count"]);
  designatedAccount = createDelegate("designatedAccount", ["findMany", "count"]);
  auditEvent = createDelegate("auditEvent", ["findMany"]);
  async $disconnect(): Promise<void> {
    // no-op for the fake client
  }
}

export const prisma = new FakePrismaClient();
