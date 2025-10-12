import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { IngestionState } from './types.js';

export async function readState(path: string): Promise<IngestionState> {
  if (!existsSync(path)) {
    return {};
  }

  const raw = await readFile(path, 'utf8');
  try {
    return JSON.parse(raw) as IngestionState;
  } catch (error) {
    throw new Error(`Failed to read ingestion state at ${path}: ${(error as Error).message}`);
  }
}

export async function writeState(path: string, state: IngestionState): Promise<void> {
  const serialised = JSON.stringify(state, null, 2);
  await writeFile(path, `${serialised}\n`, 'utf8');
}
