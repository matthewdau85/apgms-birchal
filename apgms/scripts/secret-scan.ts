#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface Pattern {
  name: string;
  regex: RegExp;
}

const patterns: Pattern[] = [
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    name: 'AWS Secret Access Key',
    regex: new RegExp(
      'aws(.{0,20})?(secret|sak|sk)(.{0,20})?(access)?(.{0,20})?(key)?\\s*[:=]\\s*[\'\"]?[A-Za-z0-9\\/+=]{40}[\'\"]?',
      'gi',
    ),
  },
  { name: 'GitHub Personal Access Token', regex: /\bghp_[A-Za-z0-9]{36}\b/g },
  { name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,48}\b/g },
  { name: 'Private key block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    name: 'Generic secret assignment',
    regex: new RegExp(
      '\\b(secret|token|password|api[-_]?key)[\\w-]*\\s*[:=]\\s*(?:[\'\"][A-Za-z0-9_\\/-]{24,}[\'\"]|(?=[A-Za-z0-9_\\/-]{32,})(?=.*[0-9])(?=.*[A-Z])[A-Za-z0-9_\\/-]{32,})',
      'gi',
    ),
  },
];

interface Finding {
  file: string;
  line: number;
  context: string;
  pattern: string;
}

function getGitRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Unable to determine git repository root.');
    process.exitCode = 2;
    throw error;
  }
}

function collectFiles(root: string, inputs: string[]): string[] {
  if (inputs.length === 0) {
    const listing = execSync('git ls-files', { cwd: root, encoding: 'utf8' });
    return listing
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean)
      .filter((file) => !file.includes('node_modules/'))
      .map((file) => path.join(root, file));
  }

  const files: string[] = [];

  function walk(entry: string) {
    const stats = fs.statSync(entry);
    if (stats.isDirectory()) {
      if (path.basename(entry) === '.git' || path.basename(entry) === 'node_modules') {
        return;
      }
      for (const child of fs.readdirSync(entry)) {
        walk(path.join(entry, child));
      }
      return;
    }

    if (stats.isFile()) {
      files.push(entry);
    }
  }

  for (const input of inputs) {
    let fullPath = path.isAbsolute(input) ? input : path.join(root, input);
    if (!fs.existsSync(fullPath)) {
      const cwdPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
      if (fs.existsSync(cwdPath)) {
        fullPath = cwdPath;
      } else {
        console.warn(`Skipping missing path: ${input}`);
        continue;
      }
    }
    walk(fullPath);
  }

  return files;
}

function isLikelyBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }
  const sample = buffer.subarray(0, 1024);
  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }
  }
  return false;
}

function scanFile(file: string, gitRoot: string): Finding[] {
  const findings: Finding[] = [];
  const buffer = fs.readFileSync(file);
  if (isLikelyBinary(buffer)) {
    return findings;
  }

  const content = buffer.toString('utf8');
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes('g') ? pattern.regex.flags : `${pattern.regex.flags}g`);
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      const before = content.slice(0, match.index ?? 0);
      const line = before.split(/\r?\n/).length;
      const lineText = content.split(/\r?\n/)[line - 1]?.trim() ?? '';
      findings.push({
        file: path.relative(gitRoot, file),
        line,
        context: lineText,
        pattern: pattern.name,
      });
    }
  }
  return findings;
}

function parseArgs(): string[] {
  const inputs: string[] = [];
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: pnpm secret-scan [paths...]');
      console.log('Run without paths to scan all tracked files.');
      process.exit(0);
    }

    if (arg === '--paths') {
      const next = args[i + 1];
      if (!next) {
        console.error('Missing value for --paths');
        process.exit(2);
      }
      inputs.push(...next.split(',').map((value) => value.trim()).filter(Boolean));
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      console.warn(`Unknown option ${arg} ignored.`);
      continue;
    }

    inputs.push(arg);
  }

  return inputs;
}

function main() {
  const gitRoot = getGitRoot();
  const inputs = parseArgs();
  const files = collectFiles(gitRoot, inputs);
  const findings: Finding[] = [];

  for (const file of files) {
    try {
      findings.push(...scanFile(file, gitRoot));
    } catch (error) {
      console.warn(`Unable to scan ${path.relative(gitRoot, file)}: ${(error as Error).message}`);
    }
  }

  if (findings.length > 0) {
    console.error('\nPotential secrets detected:');
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line} (${finding.pattern})`);
      console.error(`  > ${finding.context}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('✅ No potential secrets found.');
}

main();
