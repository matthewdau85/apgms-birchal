import React, { useState } from 'react';

type PolicyState = 'ACTIVE' | 'DRAFT' | 'DEPRECATED';

interface Policy {
  id: string;
  name: string;
  version: string;
  state: PolicyState;
  rulesJson: Record<string, unknown>;
}

const policies: Policy[] = [
  {
    id: 'policy-aml-01',
    name: 'AML transaction screening',
    version: 'v2.1',
    state: 'ACTIVE',
    rulesJson: {
      riskThreshold: 0.72,
      escalation: ['freeze_account', 'notify_compliance'],
      jurisdictions: ['AU', 'NZ'],
    },
  },
  {
    id: 'policy-liq-02',
    name: 'Liquidity reserve',
    version: 'v1.4',
    state: 'DRAFT',
    rulesJson: {
      minimumReserve: 1250000,
      alertChannels: ['ops@apgms'],
      dependencies: ['reporting.gates.sla-monitor'],
    },
  },
  {
    id: 'policy-retention-03',
    name: 'Retention & archival',
    version: 'v1.0',
    state: 'DEPRECATED',
    rulesJson: {
      retentionDays: 730,
      archivalBucket: 's3://apgms-archive',
      encrypt: true,
    },
  },
];

const stateBadgeStyles: Record<PolicyState, string> = {
  ACTIVE: 'badge badge--active',
  DRAFT: 'badge badge--draft',
  DEPRECATED: 'badge badge--deprecated',
};

const prettyPrintJson = (value: Record<string, unknown>) =>
  JSON.stringify(value, null, 2);

const PolicyRow: React.FC<{ policy: Policy }> = ({ policy }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="card" aria-labelledby={`${policy.id}-heading`}>
      <div className="card__header">
        <div className="card__title-group">
          <h3 id={`${policy.id}-heading`}>{policy.name}</h3>
          <span className="muted">{policy.version}</span>
        </div>
        <span className={stateBadgeStyles[policy.state]}>{policy.state}</span>
      </div>
      <div className="card__body">
        <button
          type="button"
          className="link-button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={`${policy.id}-rules`}
        >
          {expanded ? 'Hide rules' : 'View rules'}
        </button>
        <div
          id={`${policy.id}-rules`}
          className={`rules ${expanded ? 'rules--expanded' : 'rules--collapsed'}`}
          role="region"
          aria-live="polite"
        >
          <pre>{prettyPrintJson(policy.rulesJson)}</pre>
        </div>
      </div>
    </article>
  );
};

const PoliciesRoute: React.FC = () => {
  return (
    <section>
      <header className="section-header">
        <h2>Policies</h2>
        <p className="muted">Read-only registry of current automation policies.</p>
      </header>
      <div className="stack">
        {policies.map((policy) => (
          <PolicyRow key={policy.id} policy={policy} />
        ))}
      </div>
    </section>
  );
};

export default PoliciesRoute;
