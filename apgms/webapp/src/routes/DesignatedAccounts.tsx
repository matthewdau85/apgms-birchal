import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { FormField } from '../components/ui/form-field';
import { Select } from '../components/ui/select';

const designatedAccountSchema = z.object({
  accountName: z.string().min(2, 'Account name is required'),
  institution: z.string().min(1, 'Institution is required'),
  accountNumber: z.string().min(4, 'Account number is required'),
  owner: z.string().min(1, 'Owner is required'),
  attestationCadence: z.enum(['Monthly', 'Quarterly', 'Annually'])
});

type DesignatedAccountForm = z.infer<typeof designatedAccountSchema>;

const designatedAccounts = [
  { accountName: 'Client Trust', institution: 'ANZ', accountNumber: '123-456', owner: 'Finance', status: 'Verified' },
  { accountName: 'Operational', institution: 'CBA', accountNumber: '789-123', owner: 'Treasury', status: 'Pending' }
];

export function DesignatedAccounts() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<DesignatedAccountForm>({
    resolver: zodResolver(designatedAccountSchema),
    defaultValues: {
      accountName: '',
      institution: '',
      accountNumber: '',
      owner: '',
      attestationCadence: 'Monthly'
    }
  });

  const onSubmit = (values: DesignatedAccountForm) => {
    console.log('Designated account submitted', values);
  };

  return (
    <div className="container">
      <h2 className="section-title">Designated accounts register</h2>
      <p className="muted">
        Track bank accounts under AFSL controls. Document ownership, attestations, and attach source
        references for auditors.
      </p>

      <div className="card-grid">
        {designatedAccounts.map((account) => (
          <Card
            key={account.accountName}
            header={<h3>{account.accountName}</h3>}
            footer={<span className="badge">{account.status}</span>}
          >
            <p>
              <strong>Institution:</strong> {account.institution}
            </p>
            <p>
              <strong>Account number:</strong> {account.accountNumber}
            </p>
            <p>
              <strong>Owner:</strong> {account.owner}
            </p>
          </Card>
        ))}
      </div>

      <Card header={<h3>Add designated account</h3>}>
        <form className="form-grid two-columns" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField id="accountName" label="Account name" error={errors.accountName?.message}>
            <Input id="accountName" {...register('accountName')} placeholder="Client Trust" />
          </FormField>

          <FormField id="institution" label="Institution" error={errors.institution?.message}>
            <Input id="institution" {...register('institution')} placeholder="ANZ" />
          </FormField>

          <FormField id="accountNumber" label="Account number" error={errors.accountNumber?.message}>
            <Input id="accountNumber" {...register('accountNumber')} placeholder="123-456" />
          </FormField>

          <FormField id="owner" label="Owner" error={errors.owner?.message}>
            <Input id="owner" {...register('owner')} placeholder="Finance" />
          </FormField>

          <FormField id="attestationCadence" label="Attestation cadence">
            <Select id="attestationCadence" {...register('attestationCadence')}>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
            </Select>
          </FormField>

          <div className="form-field" style={{ alignSelf: 'end' }}>
            <Button type="submit">Save account</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
