import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type SectionStatus = 'passed' | 'failed' | 'skipped';

type SectionDefinition = {
  id: string;
  title: string;
  script: string;
  required: boolean;
};

type SectionResult = SectionDefinition & {
  status: SectionStatus;
  command: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorMessage?: string;
};

const repoRoot = resolve(__dirname, '..');
const workspaceRoot = resolve(repoRoot, 'apgms');
const reportsDir = resolve(repoRoot, 'reports');
const jsonReportPath = resolve(reportsDir, 'quality.json');
const markdownReportPath = resolve(reportsDir, 'quality.md');

const SECTION_DEFINITIONS: SectionDefinition[] = [
  { id: 'unit', title: 'Unit Tests', script: 'quality:unit', required: true },
  { id: 'golden', title: 'Golden Tests', script: 'quality:golden', required: true },
  { id: 'red-team', title: 'Red Team Tests', script: 'quality:red-team', required: true },
  { id: 'sbom-sca', title: 'SBOM / SCA', script: 'quality:sbom-sca', required: true },
  { id: 'lighthouse', title: 'Lighthouse Audits', script: 'quality:lighthouse', required: false },
  { id: 'axe', title: 'Axe Accessibility Audits', script: 'quality:axe', required: false },
];

const packageJsonPath = resolve(workspaceRoot, 'package.json');
let packageScripts: Record<string, string> = {};
try {
  const packageContents = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  packageScripts = packageContents.scripts ?? {};
} catch (error) {
  console.error(`Failed to read package.json at ${packageJsonPath}`);
  console.error(error);
  process.exit(1);
}

function hasScript(scriptName: string): boolean {
  return typeof packageScripts[scriptName] === 'string';
}

function trimOutput(output: string): string {
  const limit = 4000;
  if (output.length <= limit) {
    return output.trimEnd();
  }
  return `${output.slice(0, limit)}\n... output truncated (${output.length - limit} additional characters)`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(1).replace(/\.0$/, '');
  return `${minutes}m ${seconds}s`;
}

function statusEmoji(status: SectionStatus): string {
  switch (status) {
    case 'passed':
      return '✅ Passed';
    case 'failed':
      return '❌ Failed';
    case 'skipped':
    default:
      return '⚪ Skipped';
  }
}

function runSection(section: SectionDefinition): SectionResult {
  const startedAt = new Date();

  if (!hasScript(section.script)) {
    const status: SectionStatus = section.required ? 'failed' : 'skipped';
    const message = `Script "${section.script}" not found in package.json.`;
    return {
      ...section,
      status,
      command: `pnpm run ${section.script}`,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      exitCode: status === 'failed' ? 1 : null,
      stdout: '',
      stderr: '',
      errorMessage: message,
    };
  }

  const command = 'pnpm';
  const args = ['run', section.script];

  const result: SpawnSyncReturns<string> = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const stdout = trimOutput(result.stdout ?? '');
  const stderr = trimOutput(result.stderr ?? '');

  let status: SectionStatus = 'passed';
  let errorMessage: string | undefined;

  if (result.error) {
    status = 'failed';
    errorMessage = result.error.message;
  } else if (typeof result.status === 'number' && result.status !== 0) {
    status = 'failed';
  }

  const exitCode = typeof result.status === 'number' ? result.status : null;

  return {
    ...section,
    status,
    command: `${command} ${args.join(' ')}`,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    exitCode,
    stdout,
    stderr,
    errorMessage,
  };
}

function createMarkdownReport(results: SectionResult[], generatedAt: string): string {
  const lines: string[] = [];
  lines.push('# Quality Gate Report');
  lines.push('');
  lines.push(`_Generated at ${generatedAt}_`);
  lines.push('');
  lines.push('| Section | Status | Required | Duration |');
  lines.push('| --- | --- | --- | --- |');
  for (const result of results) {
    lines.push(`| ${result.title} | ${statusEmoji(result.status)} | ${result.required ? 'Yes' : 'No'} | ${formatDuration(result.durationMs)} |`);
  }
  lines.push('');
  lines.push('## Details');
  lines.push('');

  for (const result of results) {
    lines.push(`### ${result.title}`);
    lines.push('');
    lines.push(`- **Status:** ${statusEmoji(result.status)}`);
    lines.push(`- **Required:** ${result.required ? 'Yes' : 'No'}`);
    lines.push(`- **Command:** \`${result.command}\``);
    lines.push(`- **Duration:** ${formatDuration(result.durationMs)}`);
    lines.push(`- **Started:** ${result.startedAt}`);
    lines.push(`- **Finished:** ${result.finishedAt}`);
    if (typeof result.exitCode === 'number') {
      lines.push(`- **Exit Code:** ${result.exitCode}`);
    }
    if (result.errorMessage) {
      lines.push('');
      lines.push(`> ${result.errorMessage}`);
    }
    if (result.stdout) {
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>Stdout</summary>');
      lines.push('');
      lines.push('```');
      lines.push(result.stdout);
      lines.push('```');
      lines.push('</details>');
    }
    if (result.stderr) {
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>Stderr</summary>');
      lines.push('');
      lines.push('```');
      lines.push(result.stderr);
      lines.push('```');
      lines.push('</details>');
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main(): void {
  mkdirSync(reportsDir, { recursive: true });

  const results = SECTION_DEFINITIONS.map(runSection);
  const generatedAt = new Date().toISOString();

  const summary = {
    total: results.length,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    requiredFailed: results.some((result) => result.required && result.status !== 'passed'),
  };

  const jsonReport = {
    generatedAt,
    sections: results,
    summary,
  };

  writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
  writeFileSync(markdownReportPath, createMarkdownReport(results, generatedAt));

  console.log('Quality gate summary:');
  console.table(
    results.map((result) => ({
      section: result.title,
      status: result.status,
      required: result.required,
      duration: formatDuration(result.durationMs),
    })),
  );

  if (summary.requiredFailed) {
    console.error('Quality gate failed: one or more required sections did not pass.');
  } else {
    console.log('Quality gate passed.');
  }

  process.exitCode = summary.requiredFailed ? 1 : 0;
}

main();
