#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma, getDailyAuditBundle, formatAnchorDate } from "@apgms/shared";

interface ExportResult {
  jsonlPath: string;
  pdfPath: string;
  records: number;
  anchor: string;
}

function parseDate(input?: string): Date {
  if (!input) {
    return new Date();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }
  return parsed;
}

function escapePdf(text: string): string {
  return text.replace(/[\\()]/g, (match) => `\\${match}`);
}

function createPdf(lines: string[]): Buffer {
  const escaped = lines.map(escapePdf);
  const textBody = escaped
    .map((line, index) => (index === 0 ? `(${line}) Tj` : `0 -16 Td\n(${line}) Tj`))
    .join("\n");
  const content = `BT\n/F1 12 Tf\n72 720 Td\n${textBody}\nET\n`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  let objectCount = 0;

  const appendObject = (body: string) => {
    objectCount += 1;
    const offset = Buffer.byteLength(pdf, "utf8");
    offsets.push(offset);
    pdf += `${objectCount} 0 obj\n${body}\nendobj\n`;
  };

  appendObject("<< /Type /Catalog /Pages 2 0 R >>");
  appendObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  appendObject(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  );
  appendObject(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
  appendObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objectCount; i += 1) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

async function writeJsonl(filePath: string, records: unknown[]): Promise<void> {
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  await fs.writeFile(filePath, body ? `${body}\n` : body, "utf8");
}

async function run(dateInput?: string): Promise<ExportResult> {
  const targetDate = parseDate(dateInput);
  const { anchorDate, anchor, records } = await getDailyAuditBundle(prisma, targetDate);
  if (!anchor) {
    throw new Error(`No audit anchor found for ${formatAnchorDate(anchorDate)}`);
  }
  const isoDate = formatAnchorDate(anchorDate);
  const baseDir = path.resolve(process.cwd(), "exports", isoDate);
  await fs.mkdir(baseDir, { recursive: true });
  const jsonlPath = path.join(baseDir, `audit-${isoDate}.jsonl`);
  const pdfPath = path.join(baseDir, `audit-${isoDate}.pdf`);
  await writeJsonl(jsonlPath, records);
  const lines = [
    `Audit export for ${isoDate}`,
    `Entries: ${records.length}`,
    `Anchor hash: ${(anchor as any).hash}`,
    `Generated at: ${new Date().toISOString()}`,
  ];
  const pdf = createPdf(lines);
  await fs.writeFile(pdfPath, pdf);
  return { jsonlPath, pdfPath, records: records.length, anchor: (anchor as any).hash };
}

async function main() {
  try {
    const [, , dateInput] = process.argv;
    const result = await run(dateInput);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    if (prisma.$disconnect) {
      await prisma.$disconnect();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export { run };
