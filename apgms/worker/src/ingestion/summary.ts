import { TaxBracket, TaxRules } from './types.js';

function formatCurrency(value: number | null): string {
  if (value === null) {
    return '$∞';
  }
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.00$/, '')}%`;
}

function describeBracket(bracket: TaxBracket): string {
  const lower = formatCurrency(bracket.lower);
  const upper = bracket.upper === null ? 'and above' : `– ${formatCurrency(bracket.upper)}`;
  return `${lower} ${upper}`.trim();
}

function compareBracket(index: number, previous: TaxBracket, current: TaxBracket): string[] {
  const messages: string[] = [];
  if (previous.marginalRate !== current.marginalRate) {
    messages.push(
      `Marginal rate for bracket ${index + 1} (${describeBracket(current)}) changed from ${formatRate(previous.marginalRate)} to ${formatRate(current.marginalRate)}.`,
    );
  }
  if (previous.baseTax !== current.baseTax) {
    messages.push(
      `Base tax for bracket ${index + 1} (${describeBracket(current)}) changed from ${formatCurrency(previous.baseTax)} to ${formatCurrency(current.baseTax)}.`,
    );
  }
  if (previous.lower !== current.lower || previous.upper !== current.upper) {
    messages.push(
      `Income range for bracket ${index + 1} changed from ${describeBracket(previous)} to ${describeBracket(current)}.`,
    );
  }
  return messages;
}

export function diffTaxRules(previous: TaxRules | null, current: TaxRules): string {
  const summary: string[] = [];

  if (previous && previous.effectiveFrom !== current.effectiveFrom) {
    summary.push(`Effective from updated from ${previous.effectiveFrom} to ${current.effectiveFrom}.`);
  }

  const previousBrackets = previous?.brackets ?? [];
  const minLength = Math.min(previousBrackets.length, current.brackets.length);
  for (let index = 0; index < minLength; index += 1) {
    summary.push(...compareBracket(index, previousBrackets[index]!, current.brackets[index]!));
  }

  if (current.brackets.length > previousBrackets.length) {
    const additions = current.brackets.slice(previousBrackets.length).map((bracket) => `• ${describeBracket(bracket)}`);
    summary.push(`Added ${additions.length} bracket(s):\n${additions.join('\n')}`);
  } else if (current.brackets.length < previousBrackets.length) {
    const removals = previousBrackets.slice(current.brackets.length).map((bracket) => `• ${describeBracket(bracket)}`);
    summary.push(`Removed ${removals.length} bracket(s):\n${removals.join('\n')}`);
  }

  if (summary.length === 0) {
    summary.push('No structural changes detected.');
  }

  return summary.join('\n');
}
