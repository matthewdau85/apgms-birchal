import React from 'react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import PatentMetricCard from '../components/PatentMetricCard';
import Timeline, { TimelineEvent } from '../components/Timeline';

const metrics = [
  {
    label: 'Prosecution velocity',
    value: '42 days',
    trend: '12 days faster than industry benchmark',
  },
  {
    label: 'Claims defended',
    value: '18 / 22',
    trend: '81% acceptance rate',
    variant: 'neutral' as const,
  },
  {
    label: 'Office action risk',
    value: 'Low',
    trend: 'High novelty score (8.6 / 10)',
    variant: 'neutral' as const,
  },
];

const roadmap: TimelineEvent[] = [
  {
    date: 'Apr 18',
    title: 'Draft utility specification',
    description: 'Finalize enablement details for autonomous greenhouse coordination.',
    owner: 'Clara Preston',
  },
  {
    date: 'Apr 24',
    title: 'Peer novelty audit',
    description: 'Cross-reference generative coverage vs prior mesh patents.',
    owner: 'Tariq Menon',
  },
  {
    date: 'May 02',
    title: 'USPTO readiness review',
    description: 'Legal QA and translation package for PCT co-filing.',
    owner: 'Sarah Ito',
  },
];

const activityFeed = [
  {
    title: 'AI search insight',
    description: 'Identified 3 comparable greenhouse automation filings with low overlap score.',
    timestamp: '2 hours ago',
  },
  {
    title: 'Claim harmonization',
    description: 'Drafted claim dependencies for sensor cluster orchestration modules.',
    timestamp: 'Yesterday',
  },
  {
    title: 'Client briefing uploaded',
    description: 'Founder updated commercialization roadmap with pilot data.',
    timestamp: 'Monday',
  },
];

const DashboardPage: React.FC = () => {
  return (
    <div className="page-grid" style={{ gap: 32 }}>
      <PageHeader
        title="Patent cockpit"
        description="Monitor the end-to-end health of your flagship filing. Track prosecution velocity, collaborate with counsel, and anticipate blockers before they emerge."
        actions={
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="secondary-button" type="button">
              Share live dossier
            </button>
            <button className="primary-button" type="button">
              Generate USPTO brief
            </button>
          </div>
        }
      />

      <div className="metric-grid">
        {metrics.map((metric) => (
          <PatentMetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="page-grid page-grid--two-column">
        <SectionCard
          title="Execution roadmap"
          subtitle="Milestones synced to prosecution calendar"
          action={<button className="secondary-button">Sync to Outlook</button>}
        >
          <Timeline events={roadmap} />
        </SectionCard>

        <SectionCard title="Activity feed" subtitle="Everything your team touched this week">
          <div className="activity-list">
            {activityFeed.map((item) => (
              <div key={item.title} className="activity-item">
                <div className="activity-item__details">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </div>
                <span style={{ color: '#475467' }}>{item.timestamp}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Risk radar"
        subtitle="AI signal scoring across novelty, enablement, and marketability"
        action={<button className="secondary-button">Download diligence pack</button>}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {[
            { label: 'Novelty overlap', score: '18%', insight: 'Low overlap vs 1,200 record prior-art set.' },
            { label: 'Enablement coverage', score: '92%', insight: 'Draft describes autonomous mesh protocol in depth.' },
            { label: 'Commercial readiness', score: '73%', insight: 'Pilot metrics ready for market application addendum.' },
          ].map((risk) => (
            <div key={risk.label} className="section-card" style={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0 }}>{risk.label}</h3>
              <p style={{ fontSize: 32, margin: '12px 0', fontWeight: 700 }}>{risk.score}</p>
              <p style={{ margin: 0, color: '#475467' }}>{risk.insight}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

export default DashboardPage;
