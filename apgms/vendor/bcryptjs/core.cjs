
const { spawnSync } = require("node:child_process");

const pythonCandidates = process.env.BCRYPTJS_PYTHON
  ? [process.env.BCRYPTJS_PYTHON]
  : ["python3", "python"];
let pythonExecutable;

function resolvePython() {
  if (pythonExecutable) {
    return pythonExecutable;
  }

  for (const candidate of pythonCandidates) {
    const result = spawnSync(candidate, ["-W", "ignore::DeprecationWarning", "-c", "import sys"], {
      stdio: "ignore",
    });
    if (!result.error && result.status === 0) {
      pythonExecutable = candidate;
      return pythonExecutable;
    }
  }

  throw new Error("bcryptjs: Unable to locate a Python interpreter with the crypt module");
}

function runPython(script, args) {
  const python = resolvePython();
  const result = spawnSync(python, ["-W", "ignore::DeprecationWarning", "-c", script, ...args], {
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").toString().trim();
    throw new Error(stderr || "bcryptjs: python execution failed");
  }

  return (result.stdout || "").toString();
}

function normalizeRounds(rounds) {
  if (typeof rounds === "undefined") {
    return 10;
  }

  if (typeof rounds === "string") {
    const parsed = Number.parseInt(rounds, 10);
    if (!Number.isNaN(parsed)) {
      rounds = parsed;
    }
  }

  if (typeof rounds !== "number" || !Number.isInteger(rounds)) {
    throw new TypeError("rounds must be an integer");
  }

  if (rounds < 4 || rounds > 31) {
    throw new RangeError("rounds must be between 4 and 31");
  }

  return rounds;
}

function genSaltSync(rounds) {
  const normalized = normalizeRounds(rounds);
  const script = ['import crypt, sys', 'rounds = int(sys.argv[1])', 'value = crypt.mksalt(crypt.METHOD_BLOWFISH, rounds=1 << rounds)', 'sys.stdout.write(value)'].join("\n");
  const salt = runPython(script, [String(normalized)]).trim();
  if (!salt.startsWith("$2")) {
    throw new Error("bcryptjs: unexpected salt format");
  }
  return salt;
}

function genSalt(rounds, callback) {
  try {
    const salt = genSaltSync(rounds);
    if (typeof callback === "function") {
      queueMicrotask(() => callback(null, salt));
      return undefined;
    }
    return Promise.resolve(salt);
  } catch (error) {
    if (typeof callback === "function") {
      queueMicrotask(() => callback(error));
      return undefined;
    }
    return Promise.reject(error);
  }
}

function ensureSalt(saltOrRounds) {
  if (typeof saltOrRounds === "string") {
    return saltOrRounds;
  }
  return genSaltSync(saltOrRounds);
}

function hashSync(data, saltOrRounds) {
  if (data === undefined || data === null) {
    throw new TypeError("data must be provided");
  }

  const salt = ensureSalt(saltOrRounds);
  const script = ['import crypt, sys', 'value = crypt.crypt(sys.argv[1], sys.argv[2])', 'sys.stdout.write(value)'].join("\n");
  const hashed = runPython(script, [String(data), salt]).trim();
  if (!hashed.startsWith("$2")) {
    throw new Error("bcryptjs: unexpected hash format");
  }
  return hashed;
}

function hash(data, saltOrRounds, callback) {
  try {
    const value = hashSync(data, saltOrRounds);
    if (typeof callback === "function") {
      queueMicrotask(() => callback(null, value));
      return undefined;
    }
    return Promise.resolve(value);
  } catch (error) {
    if (typeof callback === "function") {
      queueMicrotask(() => callback(error));
      return undefined;
    }
    return Promise.reject(error);
  }
}

function compareSync(data, encrypted) {
  if (typeof encrypted !== "string") {
    throw new TypeError("encrypted must be a string");
  }
  const hashed = hashSync(data, encrypted);
  return hashed === encrypted;
}

function compare(data, encrypted, callback) {
  try {
    const result = compareSync(data, encrypted);
    if (typeof callback === "function") {
      queueMicrotask(() => callback(null, result));
      return undefined;
    }
    return Promise.resolve(result);
  } catch (error) {
    if (typeof callback === "function") {
      queueMicrotask(() => callback(error));
      return undefined;
    }
    return Promise.reject(error);
  }
}

function getRounds(encrypted) {
  if (typeof encrypted !== "string") {
    throw new TypeError("encrypted must be a string");
  }
  const parts = encrypted.split("$");
  if (parts.length < 3) {
    throw new Error("invalid hash format");
  }
  const rounds = Number.parseInt(parts[2], 10);
  if (Number.isNaN(rounds)) {
    throw new Error("invalid rounds in hash");
  }
  return rounds;
}

function getSalt(encrypted) {
  if (typeof encrypted !== "string") {
    throw new TypeError("encrypted must be a string");
  }
  const parts = encrypted.split("$");
  if (parts.length < 4) {
    throw new Error("invalid hash format");
  }
  return "$" + parts[1] + "$" + parts[2] + "$" + parts[3];
}

const bcrypt = {
  genSaltSync,
  genSalt,
  hashSync,
  hash,
  compareSync,
  compare,
  getRounds,
  getSalt,
};

module.exports = bcrypt;
module.exports.default = bcrypt;
module.exports.genSaltSync = genSaltSync;
module.exports.genSalt = genSalt;
module.exports.hashSync = hashSync;
module.exports.hash = hash;
module.exports.compareSync = compareSync;
module.exports.compare = compare;
module.exports.getRounds = getRounds;
module.exports.getSalt = getSalt;
