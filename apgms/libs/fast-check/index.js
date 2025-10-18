class Arbitrary {
  constructor(generator) {
    this.generator = generator;
  }

  generate() {
    return this.generator();
  }

  map(mapper) {
    return new Arbitrary(() => mapper(this.generate()));
  }

  chain(mapper) {
    return new Arbitrary(() => mapper(this.generate()).generate());
  }
}

class Property {
  constructor(arb, predicate) {
    this.arb = arb;
    this.predicate = predicate;
  }

  run(numRuns = 100) {
    for (let run = 0; run < numRuns; run += 1) {
      const value = this.arb.generate();
      const result = this.predicate(value);
      if (result === false) {
        throw new Error(`Property failed on run ${run}`);
      }
    }
  }
}

function integer({ min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  return new Arbitrary(() => {
    const lower = Math.ceil(min);
    const upper = Math.floor(max);
    const span = upper - lower + 1;
    if (span <= 0) {
      return lower;
    }
    return lower + Math.floor(Math.random() * span);
  });
}

function boolean() {
  return new Arbitrary(() => Math.random() < 0.5);
}

function string({ minLength = 0, maxLength = 10, charSet = "abcdefghijklmnopqrstuvwxyz" } = {}) {
  return new Arbitrary(() => {
    const min = Math.max(0, minLength);
    const max = Math.max(min, maxLength);
    const length = min + Math.floor(Math.random() * (max - min + 1));
    const available = charSet.length > 0 ? charSet : "abcdefghijklmnopqrstuvwxyz";
    let result = "";
    for (let i = 0; i < length; i += 1) {
      const idx = Math.floor(Math.random() * available.length);
      result += available[idx];
    }
    return result;
  });
}

function uuid() {
  const hex = "0123456789abcdef";
  return new Arbitrary(() => {
    const chars = Array.from({ length: 36 }, (_, index) => {
      if (index === 8 || index === 13 || index === 18 || index === 23) {
        return "-";
      }
      if (index === 14) {
        return "4";
      }
      if (index === 19) {
        return hex[(Math.random() * 4) | 8];
      }
      return hex[Math.floor(Math.random() * 16)];
    });
    return chars.join("");
  });
}

function array(arb, { minLength = 0, maxLength = minLength + 5 } = {}) {
  return new Arbitrary(() => {
    const min = Math.max(0, minLength);
    const max = Math.max(min, maxLength);
    const length = min + Math.floor(Math.random() * (max - min + 1));
    const values = [];
    for (let i = 0; i < length; i += 1) {
      values.push(arb.generate());
    }
    return values;
  });
}

function set(arb, { minLength = 0, maxLength = minLength + 5, compare } = {}) {
  const comparator =
    compare ?? ((a, b) => {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return a === b;
      }
    });

  return new Arbitrary(() => {
    const min = Math.max(0, minLength);
    const max = Math.max(min, maxLength);
    const targetLength = min + Math.floor(Math.random() * (max - min + 1));
    const values = [];
    let safety = 0;
    while (values.length < targetLength && safety < targetLength * 20) {
      safety += 1;
      const candidate = arb.generate();
      if (!values.some((value) => comparator(value, candidate))) {
        values.push(candidate);
      }
    }

    while (values.length < min) {
      const candidate = arb.generate();
      if (!values.some((value) => comparator(value, candidate))) {
        values.push(candidate);
      }
    }

    return values;
  });
}

function tuple(...arbs) {
  return new Arbitrary(() => arbs.map((arb) => arb.generate()));
}

function record(shape) {
  return new Arbitrary(() => {
    const result = {};
    for (const [key, value] of Object.entries(shape)) {
      result[key] = value.generate();
    }
    return result;
  });
}

function property(arb, predicate) {
  return new Property(arb, predicate);
}

function assert(prop, options = {}) {
  const numRuns = options.numRuns ?? 100;
  prop.run(numRuns);
}

const fc = {
  Arbitrary,
  Property,
  integer,
  boolean,
  string,
  uuid,
  array,
  set,
  tuple,
  record,
  property,
  assert,
};

export { Arbitrary, Property, integer, boolean, string, uuid, array, set, tuple, record, property, assert };
export default fc;
