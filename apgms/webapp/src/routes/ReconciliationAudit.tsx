import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FormField } from '../components/ui/form-field';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';

const reconciliationSchema = z.object({
  ledger: z.enum(['General', 'Client trust', 'Settlement']),
  periodStart: z.string().min(1, 'Start date required'),
  periodEnd: z.string().min(1, 'End date required'),
  tolerance: z.number({ invalid_type_error: 'Tolerance must be numeric' }).min(0)
});

type ReconciliationFilters = z.infer<typeof reconciliationSchema>;

const chartData = [
  { period: 'W1', ledgerBalance: 120, bankBalance: 118 },
  { period: 'W2', ledgerBalance: 124, bankBalance: 123 },
  { period: 'W3', ledgerBalance: 119, bankBalance: 118 },
  { period: 'W4', ledgerBalance: 128, bankBalance: 127 }
];

const hashChain = [
  {
    sequence: 98,
    hash: '0x6f3a...',
    previousHash: '0xd121...'
  },
  {
    sequence: 99,
    hash: '0xd121...',
    previousHash: '0xba42...'
  },
  {
    sequence: 100,
    hash: '0xba42...',
    previousHash: '0xa7f1...'
  }
];

const reconciliationFindings = [
  { reference: 'INV-245', amount: 3200, variance: '+$50', status: 'Investigating' },
  { reference: 'PAY-903', amount: 1200, variance: '-$10', status: 'Resolved' }
];

export function ReconciliationAudit() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ReconciliationFilters>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      ledger: 'Client trust',
      periodStart: '2024-02-01',
      periodEnd: '2024-02-29',
      tolerance: 5
    }
  });

  const onSubmit = (filters: ReconciliationFilters) => {
    console.log('Reconciliation filters', filters);
  };

  const summary = useMemo(
    () => ({
      unmatched: 3,
      cleared: 42,
      variance: 187
    }),
    []
  );

  return (
    <div className="container">
      <h2 className="section-title">Reconciliation & audit</h2>
      <p className="muted">
        Run reconciliations, review audit hash chains, and export evidence packages for auditors.
      </p>

      <Card header={<h3>Reconciliation parameters</h3>}>
        <form className="form-grid two-columns" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField id="ledger" label="Ledger" error={errors.ledger?.message}>
            <Select id="ledger" {...register('ledger')}>
              <option value="General">General ledger</option>
              <option value="Client trust">Client trust</option>
              <option value="Settlement">Settlement account</option>
            </Select>
          </FormField>

          <FormField id="tolerance" label="Variance tolerance" error={errors.tolerance?.message}>
            <Input id="tolerance" type="number" step="0.1" {...register('tolerance', { valueAsNumber: true })} />
          </FormField>

          <FormField id="periodStart" label="Start" error={errors.periodStart?.message}>
            <Input id="periodStart" type="date" {...register('periodStart')} />
          </FormField>

          <FormField id="periodEnd" label="End" error={errors.periodEnd?.message}>
            <Input id="periodEnd" type="date" {...register('periodEnd')} />
          </FormField>

          <div className="form-field" style={{ alignSelf: 'end' }}>
            <Button type="submit">Run reconciliation</Button>
          </div>
        </form>
      </Card>

      <div className="grid">
        <Card header={<h3>Ledger vs bank balance</h3>}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} aria-label="Ledger vs bank balance trend">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="ledgerBalance" stroke="#6366f1" name="Ledger" />
              <Line type="monotone" dataKey="bankBalance" stroke="#22d3ee" name="Bank" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card header={<h3>Variance summary</h3>}>
          <ul>
            <li>
              <strong>{summary.unmatched}</strong> unmatched items
            </li>
            <li>
              <strong>{summary.cleared}</strong> cleared during the period
            </li>
            <li>
              <strong>${summary.variance}</strong> net variance
            </li>
          </ul>
        </Card>
      </div>

      <Card header={<h3>Audit hash chain</h3>}>
        <table className="table" aria-label="Hash chain viewer">
          <thead>
            <tr>
              <th scope="col">Sequence</th>
              <th scope="col">Hash</th>
              <th scope="col">Previous hash</th>
            </tr>
          </thead>
          <tbody>
            {hashChain.map((item) => (
              <tr key={item.sequence}>
                <td>{item.sequence}</td>
                <td>
                  <code>{item.hash}</code>
                </td>
                <td>
                  <code>{item.previousHash}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card header={<h3>Exceptions</h3>}>
        <table className="table" aria-label="Reconciliation findings">
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Amount</th>
              <th scope="col">Variance</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {reconciliationFindings.map((item) => (
              <tr key={item.reference}>
                <td>{item.reference}</td>
                <td>${item.amount.toLocaleString()}</td>
                <td>{item.variance}</td>
                <td>
                  <span className="badge">{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
