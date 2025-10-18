class Random {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0xffffffff;
  }

  nextInt(min: number, max: number): number {
    if (max < min) {
      throw new Error("max must be >= min");
    }
    const range = max - min + 1;
    return Math.floor(this.next() * range) + min;
  }
}

export interface Arbitrary<T> {
  generate(rng: Random): T;
  map<U>(mapper: (value: T) => U): Arbitrary<U>;
}

class BasicArbitrary<T> implements Arbitrary<T> {
  constructor(private readonly generator: (rng: Random) => T) {}

  generate(rng: Random): T {
    return this.generator(rng);
  }

  map<U>(mapper: (value: T) => U): Arbitrary<U> {
    return new BasicArbitrary((rng) => mapper(this.generate(rng)));
  }
}

function createArbitrary<T>(generator: (rng: Random) => T): Arbitrary<T> {
  return new BasicArbitrary(generator);
}

function integer(opts: { min?: number; max?: number } = {}): Arbitrary<number> {
  const min = opts.min ?? 0;
  const max = opts.max ?? Number.MAX_SAFE_INTEGER;
  return createArbitrary((rng) => rng.nextInt(min, max));
}

function double(opts: { min?: number; max?: number; noNaN?: boolean } = {}): Arbitrary<number> {
  const min = opts.min ?? 0;
  const max = opts.max ?? 1;
  return createArbitrary((rng) => rng.next() * (max - min) + min);
}

function constant<T>(value: T): Arbitrary<T> {
  return createArbitrary(() => value);
}

function constantFrom<T>(...values: T[]): Arbitrary<T> {
  if (values.length === 0) {
    throw new Error("constantFrom requires at least one value");
  }
  return createArbitrary((rng) => {
    const index = rng.nextInt(0, values.length - 1);
    return values[index];
  });
}

function option<T>(arb: Arbitrary<T>, opts: { nil?: T } = {}): Arbitrary<T | undefined> {
  const nilValue = opts.nil ?? (undefined as unknown as T);
  return createArbitrary((rng) => {
    const pickNil = rng.next() < 0.3;
    if (pickNil) {
      return nilValue;
    }
    return arb.generate(rng);
  });
}

function oneof<T>(...arbs: Arbitrary<T>[]): Arbitrary<T> {
  if (arbs.length === 0) {
    throw new Error("oneof requires at least one arbitrary");
  }
  return createArbitrary((rng) => {
    const index = rng.nextInt(0, arbs.length - 1);
    return arbs[index].generate(rng);
  });
}

function array<T>(arb: Arbitrary<T>, opts: { minLength?: number; maxLength?: number } = {}): Arbitrary<T[]> {
  const minLength = opts.minLength ?? 0;
  const maxLength = opts.maxLength ?? Math.max(minLength, minLength + 5);
  return createArbitrary((rng) => {
    const length = rng.nextInt(minLength, maxLength);
    const result: T[] = [];
    for (let i = 0; i < length; i += 1) {
      result.push(arb.generate(rng));
    }
    return result;
  });
}

function tuple<T extends unknown[]>(...arbs: { [K in keyof T]: Arbitrary<T[K]> }): Arbitrary<T> {
  return createArbitrary((rng) => {
    const values = arbs.map((arb) => arb.generate(rng)) as T;
    return values;
  });
}

function record<T extends Record<string, Arbitrary<any>>>(shape: T): Arbitrary<{ [K in keyof T]: T[K] extends Arbitrary<infer U> ? U : never }> {
  return createArbitrary((rng) => {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      result[key] = shape[key as keyof T].generate(rng);
    }
    return result as { [K in keyof T]: T[K] extends Arbitrary<infer U> ? U : never };
  });
}

function string(opts: { minLength?: number; maxLength?: number } = {}): Arbitrary<string> {
  const minLength = opts.minLength ?? 0;
  const maxLength = opts.maxLength ?? Math.max(minLength, minLength + 12);
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return createArbitrary((rng) => {
    const length = rng.nextInt(minLength, maxLength);
    let result = "";
    for (let i = 0; i < length; i += 1) {
      const index = rng.nextInt(0, chars.length - 1);
      result += chars[index];
    }
    return result;
  });
}

function uuid(): Arbitrary<string> {
  return createArbitrary((rng) => {
    const hex = "0123456789abcdef";
    const generateSection = (length: number) => {
      let section = "";
      for (let i = 0; i < length; i += 1) {
        section += hex[rng.nextInt(0, hex.length - 1)];
      }
      return section;
    };
    return `${generateSection(8)}-${generateSection(4)}-4${generateSection(3)}-${generateSection(4)}-${generateSection(12)}`;
  });
}

type PropertyPredicate = (...args: unknown[]) => void;

class Property {
  constructor(private readonly arbs: Arbitrary<unknown>[], private readonly predicate: PropertyPredicate) {}

  run(rng: Random): void {
    const values = this.arbs.map((arb) => arb.generate(rng));
    this.predicate(...values);
  }
}

function property<T1>(arb1: Arbitrary<T1>, predicate: (arg1: T1) => void): Property;
function property<T1, T2>(arb1: Arbitrary<T1>, arb2: Arbitrary<T2>, predicate: (arg1: T1, arg2: T2) => void): Property;
function property(...args: unknown[]): Property {
  const predicate = args[args.length - 1] as PropertyPredicate;
  const arbs = args.slice(0, -1) as Arbitrary<unknown>[];
  return new Property(arbs, predicate);
}

function assert(prop: Property, opts: { numRuns?: number; seed?: number } = {}): void {
  const runs = opts.numRuns ?? 100;
  const seedBase = opts.seed ?? 123456789;
  for (let i = 0; i < runs; i += 1) {
    const rng = new Random(seedBase + i * 9973);
    try {
      prop.run(rng);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Property failed after ${i + 1} runs: ${error.message}`);
      }
      throw error;
    }
  }
}

const fc = {
  assert,
  property,
  integer,
  double,
  constant,
  constantFrom,
  option,
  oneof,
  array,
  tuple,
  record,
  string,
  uuid,
};

export default fc;
