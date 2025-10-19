import { beforeEach } from "node:test";

export const prismaMock = {
  user: {
    findMany: jestableFn(),
  },
  bankLine: {
    findMany: jestableFn(),
    create: jestableFn(),
  },
  $queryRaw: jestableFn(() => Promise.resolve([{ ok: 1 }])),
  $disconnect: jestableFn(() => Promise.resolve()),
};

function jestableFn<T extends (...args: any[]) => any>(impl?: T) {
  let handler: (...args: any[]) => any = impl ?? (() => Promise.resolve());
  const onceQueue: Array<(...args: any[]) => any> = [];
  const calls: any[][] = [];
  const fn = (...args: any[]) => {
    calls.push(args);
    if (onceQueue.length > 0) {
      return onceQueue.shift()!(...args);
    }
    return handler(...args);
  };
  fn.mockResolvedValue = (value: any) => {
    handler = () => Promise.resolve(value);
  };
  fn.mockResolvedValueOnce = (value: any) => {
    onceQueue.push(() => Promise.resolve(value));
  };
  fn.mockRejectedValue = (error: any) => {
    handler = () => Promise.reject(error);
  };
  fn.mockRejectedValueOnce = (error: any) => {
    onceQueue.push(() => Promise.reject(error));
  };
  fn.mockReset = () => {
    handler = impl ?? (() => Promise.resolve());
    onceQueue.length = 0;
    calls.length = 0;
  };
  fn.mockClear = () => {
    handler = impl ?? (() => Promise.resolve());
    onceQueue.length = 0;
    calls.length = 0;
  };
  fn.mockImplementation = (next: any) => {
    handler = next;
  };
  fn.mockImplementationOnce = (next: any) => {
    onceQueue.push(next);
  };
  (fn as any).calls = calls;

  return fn as T & {
    mockResolvedValue(value: any): void;
    mockResolvedValueOnce(value: any): void;
    mockRejectedValue(error: any): void;
    mockRejectedValueOnce(error: any): void;
    mockReset(): void;
    mockClear(): void;
    mockImplementation(next: (...args: any[]) => any): void;
    mockImplementationOnce(next: (...args: any[]) => any): void;
    calls: any[][];
  };
}

export function resetTestState() {
  prismaMock.user.findMany.mockReset();
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.bankLine.findMany.mockReset();
  prismaMock.bankLine.findMany.mockResolvedValue([]);
  prismaMock.bankLine.create.mockReset();
  prismaMock.$queryRaw.mockReset();
  prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
  prismaMock.$disconnect.mockReset();
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  process.env.JWT_ISS = process.env.JWT_ISS ?? "test-issuer";
  process.env.JWT_AUD = process.env.JWT_AUD ?? "test-audience";
  process.env.HMAC_SECRET = process.env.HMAC_SECRET ?? "test-hmac";
  process.env.CORS_ALLOWLIST = "https://allowed.test";
  (globalThis as any).__APGMS_PRISMA__ = prismaMock;
}

export function registerCommonHooks() {
  resetTestState();
  beforeEach(() => {
    resetTestState();
  });
}

registerCommonHooks();

export type PrismaMock = typeof prismaMock;
