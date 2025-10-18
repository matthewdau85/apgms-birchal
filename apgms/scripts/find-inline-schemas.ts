import { promises as fs } from 'fs';
import path from 'path';

const ROUTES_DIR = path.resolve(process.cwd(), 'services/api-gateway/src/routes');
const INLINE_SCHEMA_REGEX = /z\s*\.\s*object\s*\(/;

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      yield fullPath;
    }
  }
}

async function findInlineSchemas(): Promise<number> {
  try {
    await fs.access(ROUTES_DIR);
  } catch (error) {
    console.warn(`Routes directory not found. Skipping scan: ${ROUTES_DIR}`);
    return 0;
  }

  let count = 0;

  for await (const filePath of walk(ROUTES_DIR)) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (INLINE_SCHEMA_REGEX.test(line)) {
        count += 1;
        const relativePath = path.relative(process.cwd(), filePath);
        const lineNumber = index + 1;
        console.log(`${relativePath}:${lineNumber}`);
        console.log('  Found inline schema using z.object(...)');
        console.log('  Suggestion: import the corresponding schema from the centralized schema module instead.');
        console.log('');
      }
    });
  }

  if (count === 0) {
    console.log('No inline schemas detected.');
  }

  return count === 0 ? 0 : 1;
}

findInlineSchemas()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error('Error scanning for inline schemas:', error);
    process.exitCode = 1;
  });
