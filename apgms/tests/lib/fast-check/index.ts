type Arbitrary<T> = {
  generate: () => T;
};

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function integer({ min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}): Arbitrary<number> {
  return {
    generate: () => randomBetween(min, max),
  };
}

export function record<T extends Record<string, Arbitrary<unknown>>>(shape: T): Arbitrary<{ [K in keyof T]: ReturnType<T[K]["generate"]> }> {
  return {
    generate: () => {
      const output: Record<string, unknown> = {};
      for (const [key, arbitrary] of Object.entries(shape)) {
        output[key] = (arbitrary as Arbitrary<unknown>).generate();
      }
      return output as any;
    },
  };
}

type PropertyFn = (...values: any[]) => void | boolean | Promise<void | boolean>;

type Property = {
  run: () => Promise<void>;
};

function toPromise(result: unknown): Promise<void> {
  if (result instanceof Promise) {
    return result.then((value) => {
      if (value === false) {
        throw new Error("property returned false");
      }
    });
  }
  if (result === false) {
    return Promise.reject(new Error("property returned false"));
  }
  return Promise.resolve();
}

export function property(...args: [...Arbitrary<unknown>[], PropertyFn]): Property {
  const predicate = args.at(-1) as PropertyFn;
  const arbitraries = args.slice(0, -1) as Arbitrary<unknown>[];
  return {
    async run() {
      const values = arbitraries.map((arb) => arb.generate());
      await toPromise(predicate(...values));
    },
  };
}

export async function assert(property: Property, { verbose = false, numRuns = 50 }: { verbose?: boolean; numRuns?: number } = {}) {
  for (let i = 0; i < numRuns; i++) {
    try {
      await property.run();
    } catch (error) {
      if (verbose) {
        console.error(`Property failed on run #${i + 1}`);
      }
      throw error;
    }
  }
}
