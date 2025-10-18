import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { FormField } from '../components/ui/form-field';
import { Select } from '../components/ui/select';

const allocationSchema = z.object({
  gates: z.array(
    z.object({
      label: z.string().min(1, 'Gate label is required'),
      threshold: z.number({ invalid_type_error: 'Provide a numeric threshold' }).min(0),
      dimension: z.enum(['transaction_amount', 'liquidity_ratio', 'exposure']),
      escalation: z.enum(['Notify', 'Block', 'Review'])
    })
  )
});

type AllocationFormValues = z.infer<typeof allocationSchema>;

const defaultGate = {
  label: 'Default limit',
  threshold: 100000,
  dimension: 'transaction_amount' as const,
  escalation: 'Review' as const
};

export function AllocationsGates() {
  const form = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationSchema),
    defaultValues: {
      gates: [defaultGate]
    }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'gates' });

  const onSubmit = (values: AllocationFormValues) => {
    console.log('Allocation gates saved', values);
  };

  return (
    <form className="container" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <h2 className="section-title">Allocations & gating logic</h2>
      <p className="muted">
        Model allocation bands, gating thresholds, and escalation pathways that drive platform
        automation.
      </p>

      <div className="grid">
        {fields.map((field, index) => (
          <Card
            key={field.id}
            header={<h3>{field.label || `Gate ${index + 1}`}</h3>}
            footer={
              <Button type="button" variant="ghost" onClick={() => remove(index)}>
                Remove gate
              </Button>
            }
          >
            <div className="form-grid">
              <FormField
                id={`gates.${index}.label`}
                label="Gate label"
                error={form.formState.errors.gates?.[index]?.label?.message}
              >
                <Input id={`gates.${index}.label`} {...form.register(`gates.${index}.label` as const)} />
              </FormField>

              <FormField
                id={`gates.${index}.threshold`}
                label="Threshold"
                error={form.formState.errors.gates?.[index]?.threshold?.message}
              >
                <Input
                  id={`gates.${index}.threshold`}
                  type="number"
                  step="0.01"
                  {...form.register(`gates.${index}.threshold` as const, { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                id={`gates.${index}.dimension`}
                label="Dimension"
                error={form.formState.errors.gates?.[index]?.dimension?.message}
              >
                <Select id={`gates.${index}.dimension`} {...form.register(`gates.${index}.dimension` as const)}>
                  <option value="transaction_amount">Transaction amount</option>
                  <option value="liquidity_ratio">Liquidity ratio</option>
                  <option value="exposure">Exposure</option>
                </Select>
              </FormField>

              <FormField
                id={`gates.${index}.escalation`}
                label="Escalation action"
                error={form.formState.errors.gates?.[index]?.escalation?.message}
              >
                <Select id={`gates.${index}.escalation`} {...form.register(`gates.${index}.escalation` as const)}>
                  <option value="Notify">Notify</option>
                  <option value="Block">Block</option>
                  <option value="Review">Review</option>
                </Select>
              </FormField>
            </div>
          </Card>
        ))}
      </div>

      <div className="wizard-actions" style={{ justifyContent: 'space-between' }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            append({ label: '', threshold: 0, dimension: 'transaction_amount', escalation: 'Notify' })
          }
        >
          Add gate
        </Button>
        <Button type="submit">Save gating</Button>
      </div>
    </form>
  );
}
