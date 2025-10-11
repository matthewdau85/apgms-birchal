import { AuditLogger } from './audit.js';
import { InMemoryQueue } from './queue.js';
import { getParserForFormat } from './parsers.js';
import { matchTransactions } from './matcher.js';

export class ReconciliationService {
  constructor({ queue, auditLogger, threshold } = {}) {
    this.queue = queue ?? new InMemoryQueue();
    this.auditLogger = auditLogger ?? new AuditLogger();
    this.threshold = threshold ?? 0.9;
  }

  parse(format, payload) {
    const parser = getParserForFormat(format);
    return parser(payload);
  }

  reconcile({
    bank,
    ledger,
    matcherOptions = {}
  }) {
    if (!bank || !ledger) {
      throw new Error('Bank and ledger data are required');
    }

    const bankTransactions = this.parse(bank.format, bank.data);
    const ledgerTransactions = this.parse(ledger.format, ledger.data);

    const result = matchTransactions(bankTransactions, ledgerTransactions, {
      ...matcherOptions,
      threshold: matcherOptions.threshold ?? this.threshold
    });

    for (const match of result.matches) {
      this.auditLogger.emit({
        type: 'match',
        bankId: match.bank.id,
        ledgerId: match.ledger.id,
        score: match.score
      });
    }

    for (const entry of result.unmatched) {
      this.queue.enqueue({
        transaction: entry.bank,
        attemptedScore: entry.score,
        suggestedLedgerId: entry.bestCandidate?.id
      });
      this.auditLogger.emit({
        type: 'queued',
        bankId: entry.bank.id,
        suggestedLedgerId: entry.bestCandidate?.id,
        score: entry.score
      });
    }

    return {
      matches: result.matches,
      queued: result.unmatched.map((entry) => entry.bank)
    };
  }
}
