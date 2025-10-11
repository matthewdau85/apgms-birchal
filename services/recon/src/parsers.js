import { randomUUID } from 'node:crypto';

/**
 * Normalizes a string and trims BOM/whitespace.
 * @param {string} input
 * @returns {string}
 */
function cleanInput(input) {
  if (typeof input !== 'string') {
    throw new TypeError('Expected input to be a string');
  }
  return input.replace(/^\uFEFF/, '').trim();
}

/**
 * Parses a date string into a JavaScript Date.
 * Falls back to new Date parsing and throws if invalid.
 * @param {string} value
 * @returns {Date}
 */
function parseDate(value) {
  if (!value) {
    throw new Error('Missing date value');
  }
  const normalised = value.trim();
  // Handle QIF style dates that use YYYY-MM-DD or YYYY/MM/DD
  const isoCandidate = normalised
    .replace(/'(\d{2})$/, '20$1')
    .replace(/(\d{4})\/(\d{2})\/(\d{2})/, '$1-$2-$3')
    .replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2');
  const date = new Date(isoCandidate);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unable to parse date value: ${value}`);
  }
  return date;
}

/**
 * Parses an OFX date value in YYYYMMDD or YYYYMMDDHHmm format.
 * @param {string} value
 * @returns {Date}
 */
function parseOfxDate(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(`${year}-${month}-${day}`);
  }
  return parseDate(trimmed);
}

/**
 * Normalises a parsed transaction object.
 * @param {{ id?: string; date: Date; amount: number; description: string; source?: string }} txn
 * @returns {{ id: string; date: Date; amount: number; description: string; source: string }}
 */
function normaliseTransaction(txn) {
  const { id, date, amount, description, source = 'unknown' } = txn;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Transaction date is invalid');
  }
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    throw new Error('Transaction amount is invalid');
  }
  return {
    id: id ?? randomUUID(),
    date,
    amount,
    description: description ?? '',
    source
  };
}

/**
 * Parses CSV data into transactions.
 * Supports the headers: date,amount,description,id (case insensitive).
 * @param {string} csv
 * @returns {Array<{ id: string; date: Date; amount: number; description: string; source: string }>}
 */
export function parseCsvTransactions(csv) {
  const lines = cleanInput(csv).split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const header = lines[0]
    .split(',')
    .map((segment) => segment.trim().toLowerCase());
  const indexOf = (field) => header.indexOf(field);
  const dateIdx = indexOf('date');
  const amountIdx = indexOf('amount');
  const descriptionIdx = indexOf('description');
  const idIdx = indexOf('id');

  return lines.slice(1).map((line) => {
    const parts = line.split(',');
    const dateValue = parts[dateIdx]?.trim();
    const amountValue = parts[amountIdx]?.trim();
    const description = descriptionIdx >= 0 ? parts[descriptionIdx]?.trim() ?? '' : '';
    const id = idIdx >= 0 ? parts[idIdx]?.trim() : undefined;

    return normaliseTransaction({
      id,
      date: parseDate(dateValue),
      amount: Number.parseFloat(amountValue ?? '0'),
      description,
      source: 'csv'
    });
  });
}

/**
 * Parses QIF formatted data. Only a subset of the spec is supported (D, T, P, M, N fields).
 * @param {string} qif
 * @returns {Array<{ id: string; date: Date; amount: number; description: string; source: string }>}
 */
export function parseQifTransactions(qif) {
  const content = cleanInput(qif);
  if (!content) {
    return [];
  }
  const entries = content
    .split('^')
    .map((block) => block.trim())
    .filter(Boolean);
  const transactions = [];

  for (const entry of entries) {
    const lines = entry.split(/\r?\n/);
    const txn = { source: 'qif' };
    for (const line of lines) {
      if (!line) continue;
      const code = line[0];
      const value = line.slice(1).trim();
      switch (code) {
        case 'D':
          txn.date = parseDate(value);
          break;
        case 'T':
          txn.amount = Number.parseFloat(value.replace(/,/g, ''));
          break;
        case 'P':
          txn.description = value;
          break;
        case 'M':
          txn.description = txn.description ? `${txn.description} ${value}`.trim() : value;
          break;
        case 'N':
          txn.id = value;
          break;
        default:
          break;
      }
    }
    if (!txn.date || typeof txn.amount !== 'number') {
      continue;
    }
    transactions.push(normaliseTransaction(txn));
  }

  return transactions;
}

/**
 * Parses OFX data into transactions. Supports DTPOSTED, TRNAMT, FITID, NAME and MEMO tags.
 * @param {string} ofx
 * @returns {Array<{ id: string; date: Date; amount: number; description: string; source: string }>}
 */
export function parseOfxTransactions(ofx) {
  const input = cleanInput(ofx);
  if (!input) {
    return [];
  }
  const transactions = [];
  const stmtRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  const extractTag = (block, tag) => {
    const tagRegex = new RegExp(`<${tag}>([^<\r\n]+)`, 'i');
    const result = block.match(tagRegex);
    return result ? result[1].trim() : undefined;
  };

  while ((match = stmtRegex.exec(input)) !== null) {
    const block = match[1];
    const dateRaw = extractTag(block, 'DTPOSTED');
    const amountRaw = extractTag(block, 'TRNAMT');
    const id = extractTag(block, 'FITID') ?? extractTag(block, 'REFNUM');
    const description =
      extractTag(block, 'NAME') ?? extractTag(block, 'MEMO') ?? extractTag(block, 'PAYEE') ?? '';

    if (!dateRaw || !amountRaw) {
      continue;
    }

    const amount = Number.parseFloat(amountRaw.replace(/,/g, ''));

    transactions.push(
      normaliseTransaction({
        id,
        date: parseOfxDate(dateRaw),
        amount,
        description,
        source: 'ofx'
      })
    );
  }

  return transactions;
}

export function getParserForFormat(format) {
  const key = format?.toLowerCase();
  switch (key) {
    case 'csv':
      return parseCsvTransactions;
    case 'ofx':
      return parseOfxTransactions;
    case 'qif':
      return parseQifTransactions;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

export { parseDate };
