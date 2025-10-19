import assert from "node:assert/strict";
import {
  addAfterEach,
  addBeforeEach,
  addTest,
  pushSuite,
  type Hook,
  type TestHandler,
} from "./internal";

type MaybePromise<T> = T | Promise<T>;

type ExpectationTarget = any;

export function describe(name: string, handler: () => MaybePromise<void>) {
  pushSuite(name, () => {
    const outcome = handler();
    if (outcome instanceof Promise) {
      throw new Error("describe handlers must not return a promise");
    }
  });
}

export const it = test;

export function test(name: string, handler: TestHandler) {
  addTest(name, handler);
}

export function beforeEach(handler: Hook) {
  addBeforeEach(handler);
}

export function afterEach(handler: Hook) {
  addAfterEach(handler);
}

function contains(target: ExpectationTarget, expected: unknown): boolean {
  if (typeof target === "string") {
    return target.includes(String(expected));
  }
  if (Array.isArray(target)) {
    return target.some((value) => Object.is(value, expected));
  }
  throw new Error("toContain matcher requires a string or array target");
}

export function expect(received: ExpectationTarget) {
  return {
    toBe(expected: unknown) {
      assert.strictEqual(received, expected);
    },
    toEqual(expected: unknown) {
      assert.deepStrictEqual(received, expected);
    },
    toMatchObject(expected: Record<string, unknown>) {
      if (received === null || typeof received !== "object") {
        throw new Error("toMatchObject requires an object target");
      }
      for (const [key, value] of Object.entries(expected)) {
        assert.deepStrictEqual((received as Record<string, unknown>)[key], value);
      }
    },
    toContain(expected: unknown) {
      if (!contains(received, expected)) {
        throw new Error(`Expected value to contain ${String(expected)}`);
      }
    },
    toBeTruthy() {
      assert.ok(received);
    },
    toHaveLength(length: number) {
      if (received == null || typeof (received as any).length !== "number") {
        throw new Error("toHaveLength requires a value with a length property");
      }
      assert.strictEqual((received as any).length, length);
    },
  };
}
