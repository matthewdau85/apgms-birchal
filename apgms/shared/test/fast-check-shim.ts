import { randomUUID } from "node:crypto";

interface Arbitrary<T> {
  generate(): T;
  map<U>(mapper: (value: T) => U): Arbitrary<U>;
}

class SimpleArbitrary<T> implements Arbitrary<T> {
  constructor(private readonly factory: () => T) {}

  generate(): T {
    return this.factory();
  }

  map<U>(mapper: (value: T) => U): Arbitrary<U> {
    return new SimpleArbitrary(() => mapper(this.generate()));
  }
}

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const characters = "abcdefghijklmnopqrstuvwxyz0123456789";

const string = ({
  minLength = 0,
  maxLength = 16,
}: {
  minLength?: number;
  maxLength?: number;
}) =>
  new SimpleArbitrary(() => {
    const length = randomInt(minLength, Math.max(minLength, maxLength));
    let result = "";
    for (let index = 0; index < length; index += 1) {
      result += characters.charAt(randomInt(0, characters.length - 1));
    }
    return result;
  });

const integer = ({
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
}: {
  min?: number;
  max?: number;
}) => new SimpleArbitrary(() => randomInt(min, max));

const uuid = () => new SimpleArbitrary(() => randomUUID());

const date = () =>
  new SimpleArbitrary(() => new Date(randomInt(0, Date.now())));

const constantFrom = <T>(...values: readonly T[]) =>
  new SimpleArbitrary(() => values[randomInt(0, values.length - 1)]);

const option = <T>(arb: Arbitrary<T>, { nil = undefined } = {}) =>
  new SimpleArbitrary<T | undefined>(() =>
    Math.random() < 0.5 ? (nil as T | undefined) : arb.generate(),
  );

const array = <T>(
  arb: Arbitrary<T>,
  {
    minLength = 0,
    maxLength = 5,
  }: {
    minLength?: number;
    maxLength?: number;
  } = {},
) =>
  new SimpleArbitrary(() => {
    const size = randomInt(minLength, Math.max(minLength, maxLength));
    const result: T[] = [];
    for (let index = 0; index < size; index += 1) {
      result.push(arb.generate());
    }
    return result;
  });

const record = <T extends Record<string, Arbitrary<unknown>>>(shape: T) =>
  new SimpleArbitrary(() => {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(shape)) {
      output[key] = (value as Arbitrary<unknown>).generate();
    }
    return output as { [K in keyof T]: T[K] extends Arbitrary<infer V> ? V : never };
  });

interface Property {
  run(): Promise<void>;
}

const asyncProperty = <Args extends unknown[]>(
  ...args: [...{ [K in keyof Args]: Arbitrary<Args[K]> }, (...values: Args) => unknown]
): Property => {
  const predicate = args[args.length - 1] as (...values: Args) => unknown;
  const arbitraries = args.slice(0, -1) as { [K in keyof Args]: Arbitrary<Args[K]> };

  return {
    async run() {
      const values = arbitraries.map((arb) => arb.generate()) as Args;
      await predicate(...values);
    },
  };
};

const assert = async (property: Property, options?: { numRuns?: number }) => {
  const runs = options?.numRuns ?? 100;
  for (let index = 0; index < runs; index += 1) {
    await property.run();
  }
};

const fc = {
  record,
  string,
  integer,
  uuid,
  date,
  constantFrom,
  option,
  array,
  asyncProperty,
  assert,
};

export default fc;
