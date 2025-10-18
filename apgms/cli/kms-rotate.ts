#!/usr/bin/env node
import path from "node:path";
import { createFileKMS } from "../shared/crypto/kms";

async function main() {
  const [, , statePathArg] = process.argv;
  const statePath = statePathArg ? path.resolve(statePathArg) : path.resolve(process.cwd(), "kms-state.json");
  const kms = await createFileKMS(statePath);
  const metadata = await kms.rotate();
  console.log(JSON.stringify({ rotatedKey: metadata, statePath }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export { main };
