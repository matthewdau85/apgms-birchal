/*
 * Minimal deterministic property testing utilities providing a subset of the fast-check API
 * required by the policy engine tests. This implementation focuses on deterministic generation
 * to ensure reproducible property runs within constrained environments.
 */

type CompareFn<T> = (a: T, b: T) => boolean;

type NilOption<T> = { nil?: T };

type ArbitraryGenerator<T> = (rng: Random) => T;

class Arbitrary<T> {
  constructor(private readonly generator: ArbitraryGenerator<T>) {}

  generate(rng: Random): T {
    return this.generator(rng);
  }

  map<U>(mapper: (value: T) => U): Arbitrary<U> {
    return new Arbitrary<U>((rng) => mapper(this.generate(rng)));
  }

  chain<U>(mapper: (value: T) => Arbitrary<U>): Arbitrary<U> {
    return new Arbitrary<U>((rng) => mapper(this.generate(rng)).generate(rng));
  }
}

class Random {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = seed & ((1n << 64n) - 1n);
    if (this.state === 0n) {
      this.state = 1n;
    }
  }

  next(): bigint {
    let x = this.state;
    x ^= x << 13n;
    x ^= x >> 7n;
    x ^= x << 17n;
    this.state = x & ((1n << 64n) - 1n);
    return this.state;
  }

  nextInt(min: number, max: number): number {
    if (max < min) {
      throw new Error(`Invalid range ${min}-${max}`);
    }
    const range = BigInt(max - min + 1);
    const value = this.next() % range;
    return min + Number(value);
  }

  nextBigInt(maxExclusive: bigint): bigint {
    if (maxExclusive <= 0n) {
      return 0n;
    }
    const bits = maxExclusive.toString(2).length;
    let candidate = 0n;
    do {
      candidate = 0n;
      let produced = 0;
      while (produced < bits) {
        candidate = (candidate << 16n) | (this.next() & 0xffffn);
        produced += 16;
      }
      candidate %= maxExclusive;
    } while (candidate >= maxExclusive);
    return candidate;
  }
}

interface AssertOptions {
  numRuns?: number;
}

interface SetOptions<T> {
  minLength?: number;
  maxLength?: number;
  compare?: CompareFn<T>;
}

interface OptionOptions<T> {
  nil?: T;
}

interface HexaStringConstraints {
  minLength?: number;
  maxLength?: number;
}

interface IntegerConstraints {
  min?: number;
  max?: number;
}

const DEFAULT_SEED = 0x1a2b3c4d5e6f7801n;

class Property<T> {
  constructor(public readonly arbitrary: Arbitrary<T>, public readonly predicate: (value: T) => boolean) {}
}

function constantFrom<T>(...values: T[]): Arbitrary<T> {
  if (values.length === 0) {
    throw new Error('constantFrom requires at least one value');
  }
  return new Arbitrary<T>((rng) => values[rng.nextInt(0, values.length - 1)]);
}

function integer(constraints: IntegerConstraints): Arbitrary<number> {
  const min = constraints.min ?? Number.MIN_SAFE_INTEGER;
  const max = constraints.max ?? Number.MAX_SAFE_INTEGER;
  return new Arbitrary<number>((rng) => rng.nextInt(min, max));
}

function bigUintN(bits: number): Arbitrary<bigint> {
  if (bits <= 0) {
    return new Arbitrary(() => 0n);
  }
  return new Arbitrary<bigint>((rng) => {
    const max = 1n << BigInt(bits);
    return rng.nextBigInt(max);
  });
}

function tuple<A, B>(arbA: Arbitrary<A>, arbB: Arbitrary<B>): Arbitrary<[A, B]>;
function tuple<T>(...arbs: Arbitrary<T>[]): Arbitrary<T[]>;
function tuple<T>(...arbs: Arbitrary<T>[]): Arbitrary<T[]> {
  return new Arbitrary<T[]>((rng) => arbs.map((arb) => arb.generate(rng)));
}

function option<T>(arb: Arbitrary<T>, options: OptionOptions<T> & NilOption<T> = {}): Arbitrary<T | undefined> {
  const nilValue = options.nil as T | undefined;
  return new Arbitrary<T | undefined>((rng) => {
    const choice = rng.nextInt(0, 1);
    if (choice === 0) {
      return nilValue;
    }
    return arb.generate(rng);
  });
}

function set<T>(arb: Arbitrary<T>, options: SetOptions<T> = {}): Arbitrary<T[]> {
  const min = options.minLength ?? 0;
  const max = options.maxLength ?? min;
  const compare = options.compare ?? ((a: T, b: T) => a === b);
  return new Arbitrary<T[]>((rng) => {
    const target = max === min ? max : rng.nextInt(min, max);
    const result: T[] = [];
    const maxAttempts = target === 0 ? 1 : target * 10;
    let attempts = 0;
    while (result.length < target && attempts < maxAttempts) {
      attempts += 1;
      const candidate = arb.generate(rng);
      if (!result.some((existing) => compare(existing, candidate))) {
        result.push(candidate);
      }
    }
    while (result.length < min) {
      const candidate = arb.generate(rng);
      if (!result.some((existing) => compare(existing, candidate))) {
        result.push(candidate);
      }
    }
    return result;
  });
}

function record<TRecord extends Record<string, Arbitrary<any>>>(schema: TRecord): Arbitrary<{ [K in keyof TRecord]: ReturnType<TRecord[K]['generate']> }> {
  return new Arbitrary((rng) => {
    const result: Record<string, unknown> = {};
    for (const [key, arb] of Object.entries(schema)) {
      result[key] = (arb as Arbitrary<unknown>).generate(rng);
    }
    return result as { [K in keyof TRecord]: ReturnType<TRecord[K]['generate']> };
  });
}

function hexaString(constraints: HexaStringConstraints = {}): Arbitrary<string> {
  const min = constraints.minLength ?? 0;
  const max = constraints.maxLength ?? Math.max(min, 16);
  const chars = '0123456789abcdef';
  return new Arbitrary<string>((rng) => {
    const length = max === min ? max : rng.nextInt(min, max);
    let output = '';
    for (let index = 0; index < length; index += 1) {
      output += chars[rng.nextInt(0, chars.length - 1)];
    }
    return output;
  });
}

function property<T>(arb: Arbitrary<T>, predicate: (value: T) => boolean): Property<T> {
  return new Property(arb, predicate);
}

function assert<T>(prop: Property<T>, options: AssertOptions = {}): void {
  const runs = options.numRuns ?? 100;
  const rng = new Random(DEFAULT_SEED);
  for (let run = 0; run < runs; run += 1) {
    const value = prop.arbitrary.generate(rng);
    const passed = prop.predicate(value);
    if (!passed) {
      throw new Error(`Property failed on run ${run}`);
    }
  }
}

const fc = {
  constantFrom,
  integer,
  bigUintN,
  tuple,
  option,
  set,
  record,
  hexaString,
  property,
  assert,
};

export default fc;
export type { Property };
