export class Arbitrary<T> {
  constructor(generator: () => T);
  generate(): T;
  map<U>(mapper: (value: T) => U): Arbitrary<U>;
  chain<U>(mapper: (value: T) => Arbitrary<U>): Arbitrary<U>;
}

export class Property<T> {
  constructor(arb: Arbitrary<T>, predicate: (value: T) => boolean | void);
  run(numRuns?: number): void;
}

export interface IntegerConstraints {
  min?: number;
  max?: number;
}

export interface StringConstraints {
  minLength?: number;
  maxLength?: number;
  charSet?: string;
}

export interface ArrayConstraints {
  minLength?: number;
  maxLength?: number;
}

export interface SetConstraints<T> extends ArrayConstraints {
  compare?: (a: T, b: T) => boolean;
}

export function integer(constraints?: IntegerConstraints): Arbitrary<number>;
export function boolean(): Arbitrary<boolean>;
export function string(constraints?: StringConstraints): Arbitrary<string>;
export function uuid(): Arbitrary<string>;
export function array<T>(arb: Arbitrary<T>, constraints?: ArrayConstraints): Arbitrary<T[]>;
export function set<T>(arb: Arbitrary<T>, constraints?: SetConstraints<T>): Arbitrary<T[]>;
export function tuple<A>(a: Arbitrary<A>): Arbitrary<[A]>;
export function tuple<A, B>(a: Arbitrary<A>, b: Arbitrary<B>): Arbitrary<[A, B]>;
export function tuple<A, B, C>(a: Arbitrary<A>, b: Arbitrary<B>, c: Arbitrary<C>): Arbitrary<[A, B, C]>;
export function tuple<T extends any[]>(...arbs: { [K in keyof T]: Arbitrary<T[K]> }): Arbitrary<T>;
export function record<TArbs extends { [key: string]: Arbitrary<any> }>(arbs: TArbs): Arbitrary<{ [K in keyof TArbs]: TArbs[K] extends Arbitrary<infer U> ? U : never }>;
export function property<T>(arb: Arbitrary<T>, predicate: (value: T) => boolean | void): Property<T>;
export function assert<T>(prop: Property<T>, options?: { numRuns?: number }): void;

const fc: {
  Arbitrary: typeof Arbitrary;
  Property: typeof Property;
  integer: typeof integer;
  boolean: typeof boolean;
  string: typeof string;
  uuid: typeof uuid;
  array: typeof array;
  set: typeof set;
  tuple: typeof tuple;
  record: typeof record;
  property: typeof property;
  assert: typeof assert;
};

export default fc;
