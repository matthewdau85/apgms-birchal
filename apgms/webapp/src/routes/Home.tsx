import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const summaryCards = [
  {
    title: 'Onboarding progress',
    value: '3 / 5 tasks complete',
    description: 'Finish configuring BAS schedule and enable connectors to go live.'
  },
  {
    title: 'Designated accounts',
    value: '12 accounts',
    description: '5 accounts pending attestation'
  },
  {
    title: 'Open anomalies',
    value: '7 flagged',
    description: 'Most recent: payment mismatch on 22 Mar 2024'
  }
];

export function Home() {
  return (
    <div className="container">
      <h2 className="section-title">Operational overview</h2>
      <div className="card-grid">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            header={<h3>{card.title}</h3>}
            footer={<Button variant="secondary">View details</Button>}
          >
            <p className="muted">{card.value}</p>
            <p>{card.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
