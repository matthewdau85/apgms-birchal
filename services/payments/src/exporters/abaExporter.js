const LINE_LENGTH = 120;

function formatField(value, length, alignment = 'left', padChar = ' ') {
  const truncated = value.length > length ? value.slice(0, length) : value;
  if (alignment === 'right') {
    return truncated.padStart(length, padChar);
  }
  return truncated.padEnd(length, padChar);
}

function stripNonDigits(value) {
  return value.replace(/[^0-9]/g, '');
}

function formatAmount(amountCents) {
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    throw new Error('Amounts must be positive numbers expressed in cents.');
  }
  return formatField(Math.round(amountCents).toString(), 10, 'right', '0');
}

function formatDate(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = (date.getFullYear() % 100).toString().padStart(2, '0');
  return `${day}${month}${year}`;
}

function ensureLineLength(line) {
  if (line.length !== LINE_LENGTH) {
    throw new Error(`Expected ABA line to be ${LINE_LENGTH} characters but received ${line.length}.`);
  }
  return line;
}

export function exportAbaFile(header, transactions) {
  const headerLine = ensureLineLength(
    [
      '0',
      formatField('', 7),
      formatField('', 9),
      formatField(header.financialInstitution.toUpperCase(), 3),
      formatField('', 7),
      formatField(header.userName.toUpperCase(), 26),
      formatField(header.userNumber, 6, 'right', '0'),
      formatField(header.description.toUpperCase(), 12),
      formatField(formatDate(header.processDate), 6, 'right', '0'),
      formatField('', 3),
      formatField('', 40)
    ].join('')
  );

  let totalCents = 0;

  const detailLines = transactions.map((txn) => {
    totalCents += txn.amountCents;
    const transactionCode = txn.transactionCode ?? '50';
    return ensureLineLength(
      [
        '1',
        formatField(stripNonDigits(txn.bsb), 7, 'right', '0'),
        formatField(stripNonDigits(txn.accountNumber), 9, 'right', '0'),
        formatField(' ', 1),
        formatField(transactionCode, 2, 'right', '0'),
        formatAmount(txn.amountCents),
        formatField(txn.accountName.toUpperCase(), 32),
        formatField(txn.lodgementReference.toUpperCase(), 18),
        formatField(stripNonDigits(txn.traceBsb), 7, 'right', '0'),
        formatField(stripNonDigits(txn.traceAccountNumber), 9, 'right', '0'),
        formatField(txn.remitterName.toUpperCase(), 16),
        formatField('', 8, 'right', '0')
      ].join('')
    );
  });

  const trailerLine = ensureLineLength(
    [
      '7',
      formatField('', 7),
      formatField('', 12),
      formatAmount(totalCents),
      formatAmount(0),
      formatAmount(totalCents),
      formatField('', 24),
      formatField(transactions.length.toString(), 6, 'right', '0'),
      formatField('', 40)
    ].join('')
  );

  return [headerLine, ...detailLines, trailerLine].join('\n') + '\n';
}
