import { parseDate } from './parsers.js';

/**
 * Computes the Levenshtein distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const s = a ?? '';
  const t = b ?? '';
  const rows = s.length + 1;
  const cols = t.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

/**
 * Normalises the Levenshtein similarity into a 0..1 score.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function descriptionSimilarity(a, b) {
  const strA = (a ?? '').toLowerCase();
  const strB = (b ?? '').toLowerCase();
  if (!strA && !strB) {
    return 1;
  }
  const distance = levenshtein(strA, strB);
  const maxLen = Math.max(strA.length, strB.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * Computes the amount similarity score.
 * @param {number} amountA
 * @param {number} amountB
 * @param {number} tolerance
 * @returns {number}
 */
function amountSimilarity(amountA, amountB, tolerance) {
  const diff = Math.abs(amountA - amountB);
  if (diff < 0.005) {
    return 1;
  }
  return Math.max(0, 1 - diff / tolerance);
}

/**
 * Computes the date similarity score.
 * @param {Date} dateA
 * @param {Date} dateB
 * @param {number} windowDays
 * @returns {number}
 */
function dateSimilarity(dateA, dateB, windowDays) {
  const a = dateA instanceof Date ? dateA : parseDate(dateA);
  const b = dateB instanceof Date ? dateB : parseDate(dateB);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.abs(a.getTime() - b.getTime()) / msPerDay;
  if (diff === 0) {
    return 1;
  }
  return Math.max(0, 1 - diff / windowDays);
}

/**
 * Computes the composite match score between two transactions.
 * @param {{ amount: number; description: string; date: Date }} bank
 * @param {{ amount: number; description: string; date: Date }} ledger
 * @param {{ amountTolerance?: number; dateWindow?: number; weights?: { amount?: number; description?: number; date?: number } }} [options]
 * @returns {number}
 */
export function computeMatchScore(bank, ledger, options = {}) {
  const {
    amountTolerance = 5,
    dateWindow = 10,
    weights = { amount: 0.7, description: 0.2, date: 0.1 }
  } = options;
  const amountScore = amountSimilarity(bank.amount, ledger.amount, amountTolerance);
  const descriptionScore = descriptionSimilarity(bank.description, ledger.description);
  const dateScore = dateSimilarity(bank.date, ledger.date, dateWindow);

  return (
    (amountScore * (weights.amount ?? 0)) +
    (descriptionScore * (weights.description ?? 0)) +
    (dateScore * (weights.date ?? 0))
  );
}

/**
 * Matches bank transactions to ledger transactions.
 * @param {Array<any>} bankTransactions
 * @param {Array<any>} ledgerTransactions
 * @param {{ threshold?: number }} [options]
 * @returns {{ matches: Array<{ bank: any; ledger: any; score: number }>; unmatched: Array<{ bank: any; bestCandidate?: any; score: number }>; remainingLedger: Array<any> }}
 */
export function matchTransactions(bankTransactions, ledgerTransactions, options = {}) {
  const threshold = options.threshold ?? 0.9;
  const remainingLedger = [...ledgerTransactions];
  const matches = [];
  const unmatched = [];

  for (const bankTxn of bankTransactions) {
    let bestScore = -Infinity;
    let bestIndex = -1;

    for (let i = 0; i < remainingLedger.length; i += 1) {
      const ledgerTxn = remainingLedger[i];
      const score = computeMatchScore(bankTxn, ledgerTxn, options);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0 && bestScore + 1e-6 >= threshold) {
      const [matchedLedger] = remainingLedger.splice(bestIndex, 1);
      matches.push({ bank: bankTxn, ledger: matchedLedger, score: Number(bestScore.toFixed(3)) });
    } else {
      unmatched.push({
        bank: bankTxn,
        bestCandidate: bestIndex >= 0 ? remainingLedger[bestIndex] : undefined,
        score: bestScore === -Infinity ? 0 : Number(bestScore.toFixed(3))
      });
    }
  }

  return { matches, unmatched, remainingLedger };
}

export { levenshtein, descriptionSimilarity, amountSimilarity, dateSimilarity };
