import React from 'react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';

const holdings = [
  { asset: 'Autonomous greenhouse mesh', jurisdiction: 'USPTO', stage: 'Drafting', budget: '$48k' },
  { asset: 'Predictive irrigation AI', jurisdiction: 'EPO', stage: 'Office action', budget: '$32k' },
  { asset: 'Robotic seeding drones', jurisdiction: 'USPTO', stage: 'Granted', budget: '$26k' },
];

const forecasts = [
  { label: 'Estimated grant probability', value: '82%', detail: 'Weighted across US/EU filings' },
  { label: 'Projected licensing revenue', value: '$2.4M', detail: '12-month rolling outlook' },
  { label: 'Portfolio carbon offset impact', value: '18k tons', detail: 'Modelled from deployments' },
];

const PortfolioInsightsPage: React.FC = () => {
  return (
    <div className="page-grid" style={{ gap: 32 }}>
      <PageHeader
        title="Portfolio insights"
        description="Compare budgets, grant forecasts, and commercial impact across your filings. Prioritize where to invest drafting cycles and counsel attention."
        actions={<button className="primary-button">Export board report</button>}
      />

      <SectionCard title="Active holdings" subtitle="Snapshot of priority assets">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Jurisdiction</th>
              <th>Stage</th>
              <th>Allocated budget</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((row) => (
              <tr key={row.asset}>
                <td>{row.asset}</td>
                <td>{row.jurisdiction}</td>
                <td>{row.stage}</td>
                <td>{row.budget}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Forecast outlook" subtitle="AI projections based on prosecution history">
        <div className="metric-grid">
          {forecasts.map((item) => (
            <div key={item.label} className="section-card" style={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0 }}>{item.label}</h3>
              <p style={{ fontSize: 32, margin: '12px 0', fontWeight: 700 }}>{item.value}</p>
              <p style={{ margin: 0, color: '#475467' }}>{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Strategic guidance"
        subtitle="Automated recommendations for next quarter"
        action={<button className="secondary-button">Schedule strategy review</button>}
      >
        <ul style={{ margin: 0, paddingLeft: 20, color: '#475467', display: 'grid', gap: 12 }}>
          <li>
            Advance the autonomous greenhouse mesh filing to PCT within 60 days to maintain lead on reinforcement learning claims.
          </li>
          <li>
            Convert irrigation AI office action insights into continuation applications for European coverage.
          </li>
          <li>
            Activate licensing outreach for granted robotic seeding patents focusing on APAC agri-tech partners.
          </li>
        </ul>
      </SectionCard>
    </div>
  );
};

export default PortfolioInsightsPage;
