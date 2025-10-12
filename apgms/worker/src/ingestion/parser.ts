import { TaxBracket, TaxRules } from './types.js';

const currencyPattern = /\$?([\d,]+)/g;
const ratePattern = /(\d+(?:\.\d+)?)c/;
const datePattern = /from\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i;
const tablePattern = /<table[\s\S]*?<\/table>/i;
const rowPattern = /<tr[\s\S]*?<\/tr>/gi;
const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseCurrency(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const normalised = value.replace(/[$,\s]/g, '');
  const parsed = Number.parseInt(normalised, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseRange(rangeText: string): { lower: number; upper: number | null } {
  const matches = Array.from(rangeText.matchAll(currencyPattern));
  if (matches.length === 0) {
    return { lower: 0, upper: null };
  }

  const lower = parseCurrency(matches[0][1]);
  if (matches.length === 1) {
    const lowerIsOnly = /over|and over|above/i.test(rangeText);
    return { lower, upper: lowerIsOnly ? null : lower };
  }

  const upper = parseCurrency(matches[1][1]);
  return { lower, upper };
}

function parseTaxText(range: { lower: number }, taxText: string): { baseTax: number; marginalRate: number; threshold: number } {
  const lower = range.lower;
  const lowered = taxText.toLowerCase();
  if (lowered.includes('nil') || lowered.includes('tax-free')) {
    return { baseTax: 0, marginalRate: 0, threshold: lower };
  }

  const currencyMatches = Array.from(taxText.matchAll(currencyPattern));
  let baseTax = 0;
  let threshold = lower;

  if (currencyMatches.length > 0) {
    const maybeBase = currencyMatches[0][1];
    const plusIndex = lowered.indexOf('plus');
    const valueIndex = taxText.indexOf(`$${maybeBase}`);
    if (plusIndex !== -1 && valueIndex !== -1 && valueIndex < plusIndex) {
      baseTax = parseCurrency(maybeBase);
      currencyMatches.shift();
    }
  }

  if (currencyMatches.length > 0) {
    const lastAmount = currencyMatches[currencyMatches.length - 1][1];
    threshold = parseCurrency(lastAmount);
  }

  const rateMatch = taxText.match(ratePattern);
  const marginalRate = rateMatch ? Number.parseFloat(rateMatch[1]) / 100 : 0;

  return { baseTax, marginalRate, threshold };
}

function toISODate(value: string): string | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function extractTable(html: string): string {
  const match = html.match(tablePattern);
  if (!match) {
    throw new Error('Unable to locate tax table in HTML');
  }
  return match[0];
}

function extractRows(tableHtml: string): string[] {
  return Array.from(tableHtml.matchAll(rowPattern)).map((row) => row[0]);
}

function extractCells(rowHtml: string): string[] {
  return Array.from(rowHtml.matchAll(cellPattern)).map((cell) => stripTags(cell[1] ?? ''));
}

export function parseAtoTaxTable(html: string, slug: string, sourceUrl: string): TaxRules {
  const tableHtml = extractTable(html);
  const rows = extractRows(tableHtml);
  const dataRows = rows.filter((row) => /<td/i.test(row));

  const brackets: TaxBracket[] = [];
  dataRows.forEach((rowHtml, index) => {
    const cells = extractCells(rowHtml);
    if (cells.length < 2) {
      return;
    }
    const [rangeText, taxText] = cells;
    if (!rangeText || !taxText) {
      return;
    }

    const range = parseRange(rangeText);
    const tax = parseTaxText(range, taxText);

    brackets.push({
      index,
      lower: range.lower,
      upper: range.upper,
      marginalRate: Number(tax.marginalRate.toFixed(4)),
      baseTax: tax.baseTax,
      threshold: tax.threshold,
    });
  });

  if (brackets.length === 0) {
    throw new Error(`No brackets parsed for ${slug}`);
  }

  let effectiveFrom = new Date().toISOString().slice(0, 10);
  const dateMatch = html.match(datePattern);
  if (dateMatch) {
    const iso = toISODate(dateMatch[1]);
    if (iso) {
      effectiveFrom = iso;
    }
  }

  return {
    slug,
    effectiveFrom,
    brackets,
    sourceUrl,
  };
}
