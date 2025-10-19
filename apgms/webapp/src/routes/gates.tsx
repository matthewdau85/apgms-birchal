import React from 'react';

type GateState = 'OPEN' | 'PAUSED' | 'CLOSED';

interface Gate {
  id: string;
  name: string;
  state: GateState;
  schedule: string;
  reason?: string;
}

const gates: Gate[] = [
  {
    id: 'gate-sla-01',
    name: 'SLA monitoring gate',
    state: 'OPEN',
    schedule: 'Every 15 minutes',
  },
  {
    id: 'gate-maintenance-02',
    name: 'Maintenance blackout',
    state: 'CLOSED',
    schedule: 'Until 7 Oct 2024 02:00 UTC',
    reason: 'Ops requested downtime for ledger upgrades.',
  },
  {
    id: 'gate-backlog-03',
    name: 'Backlog throttling',
    state: 'PAUSED',
    schedule: 'Daily 01:00–03:00 UTC',
    reason: 'Auto-paused when queue > 10k events.',
  },
];

const gateTone: Record<GateState, string> = {
  OPEN: 'badge badge--active',
  PAUSED: 'badge badge--draft',
  CLOSED: 'badge badge--warning',
};

const GatesRoute: React.FC = () => {
  return (
    <section>
      <header className="section-header">
        <h2>Gates</h2>
        <p className="muted">Operational gates and their execution windows.</p>
      </header>
      <div className="stack">
        {gates.map((gate) => (
          <article
            key={gate.id}
            className={`card ${gate.state === 'CLOSED' ? 'card--warning' : ''}`}
            aria-labelledby={`${gate.id}-heading`}
          >
            <div className="card__header">
              <div className="card__title-group">
                <h3 id={`${gate.id}-heading`}>{gate.name}</h3>
                <span className="muted">{gate.schedule}</span>
              </div>
              <span className={gateTone[gate.state]}>{gate.state}</span>
            </div>
            {gate.reason && (
              <div className="card__body">
                <p className="muted">{gate.reason}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export default GatesRoute;
