import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { FormField } from '../components/ui/form-field';
import { Textarea } from '../components/ui/textarea';

const triageSchema = z.object({
  decision: z.enum(['escalate', 'close', 'snooze']),
  notes: z.string().min(5, 'Provide sufficient notes')
});

type TriageForm = z.infer<typeof triageSchema>;

const anomalies = [
  {
    id: 'AN-912',
    title: 'Settlement exceeds facility limit',
    raisedAt: '2024-03-17T09:12:00Z',
    severity: 'High',
    description: 'Settlement batch 4821 breached platform-level exposure gate by 8%.'
  },
  {
    id: 'AN-913',
    title: 'Missing remittance advice',
    raisedAt: '2024-03-18T04:21:00Z',
    severity: 'Medium',
    description: 'Expected remittance file from Gateway A not delivered in time.'
  }
];

export function AnomalyInbox() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<TriageForm>({
    resolver: zodResolver(triageSchema),
    defaultValues: { decision: 'escalate', notes: '' }
  });

  const sortedAnomalies = useMemo(() => anomalies, []);

  const onSubmit = (values: TriageForm) => {
    console.log('Triage decision', values);
    reset();
  };

  return (
    <div className="container">
      <h2 className="section-title">Anomaly inbox</h2>
      <p className="muted">
        Review gating breaches and data quality issues. Capture triage actions with audit trails for
        regulators.
      </p>

      <div className="grid">
        {sortedAnomalies.map((anomaly) => (
          <Card
            key={anomaly.id}
            header={<h3>{anomaly.title}</h3>}
            footer={<span className="badge">{anomaly.severity}</span>}
          >
            <p>
              <strong>ID:</strong> {anomaly.id}
            </p>
            <p>
              <strong>Raised:</strong> {new Date(anomaly.raisedAt).toLocaleString()}
            </p>
            <p>{anomaly.description}</p>
          </Card>
        ))}
      </div>

      <Card header={<h3>Triage selected anomaly</h3>}>
        <form className="form-grid" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField id="decision" label="Decision" error={errors.decision?.message}>
            <Select id="decision" {...register('decision')}>
              <option value="escalate">Escalate to control owner</option>
              <option value="close">Close with justification</option>
              <option value="snooze">Snooze and re-check</option>
            </Select>
          </FormField>

          <FormField id="notes" label="Notes" error={errors.notes?.message}>
            <Textarea
              id="notes"
              rows={4}
              {...register('notes')}
              placeholder="Summarise findings, attach evidence references, and note stakeholders notified."
            />
          </FormField>

          <div className="wizard-actions" style={{ justifyContent: 'flex-start' }}>
            <Button type="submit">Record triage</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
