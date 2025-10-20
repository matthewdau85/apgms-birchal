import { spawn } from "node:child_process";

const MIN_COST = 4;
const MAX_COST = 31;

function validateCost(cost: number): void {
  if (!Number.isInteger(cost)) {
    throw new TypeError(`bcrypt cost must be an integer, received ${cost}`);
  }
  if (cost < MIN_COST || cost > MAX_COST) {
    throw new RangeError(`bcrypt cost must be between ${MIN_COST} and ${MAX_COST}`);
  }
}

async function runPhpHash(password: string, cost: number): Promise<string> {
  const php = spawn("php", [
    "-r",
    '$password = stream_get_contents(STDIN); $cost = intval($argv[1]); $hash = password_hash($password, PASSWORD_BCRYPT, ["cost" => $cost]); if ($hash === false) { fwrite(STDERR, "password_hash failed"); exit(1); } echo $hash;',
    "--",
    cost.toString(),
  ]);

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    php.stdout.setEncoding("utf8");
    php.stdout.on("data", chunk => {
      stdout += chunk;
    });

    php.stderr.setEncoding("utf8");
    php.stderr.on("data", chunk => {
      stderr += chunk;
    });

    php.on("error", err => {
      reject(err);
    });

    php.on("close", code => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `php exited with code ${code}`));
      }
    });

    php.stdin.setDefaultEncoding("utf8");
    php.stdin.end(password);
  });
}

export async function hash(password: string, cost: number): Promise<string> {
  if (typeof password !== "string") {
    throw new TypeError("password must be a string");
  }

  validateCost(cost);

  const hashed = await runPhpHash(password, cost);
  if (!hashed.startsWith("$2")) {
    throw new Error("unexpected bcrypt hash format from php");
  }

  return hashed;
}

const bcrypt = { hash };
export default bcrypt;
