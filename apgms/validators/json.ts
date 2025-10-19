import Ajv, { ErrorObject } from 'ajv';
import { readFile } from 'node:fs/promises';
import { stdin } from 'node:process';

const schemaUrl = new URL('../prompts/schema.json', import.meta.url);

async function readSchema() {
  try {
    const schemaContent = await readFile(schemaUrl, 'utf8');
    return JSON.parse(schemaContent);
  } catch (error) {
    throw new Error(`Unable to load schema at ${schemaUrl.pathname}: ${(error as Error).message}`);
  }
}

async function readInput() {
  stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    throw new Error('No input provided on stdin.');
  }

  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON input: ${(error as Error).message}`);
  }
}

function formatErrors(errors: ErrorObject[] = []) {
  return errors
    .map((error) => {
      const location = error.instancePath || '/';
      const message = error.message ?? 'Validation error';
      return `- ${location} ${message}`.trim();
    })
    .join('\n');
}

async function main() {
  const [schema, data] = await Promise.all([readSchema(), readInput()]);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    console.error('Prompt validation failed:');
    console.error(formatErrors(validate.errors ?? []));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
