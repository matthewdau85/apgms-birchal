import { useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select } from '../../components/ui/select';
import { FormField } from '../../components/ui/form-field';

const onboardingSchema = z.object({
  organisationName: z.string().min(2, 'Organisation name is required'),
  registrationNumber: z.string().min(3, 'Registration number is required'),
  contactEmail: z.string().email('Provide a valid email'),
  narrative: z.string().max(500).optional(),
  basFrequency: z.enum(['Monthly', 'Quarterly', 'Annually'], {
    required_error: 'Choose a BAS filing frequency'
  }),
  basDay: z.string().min(1, 'Provide due day of month'),
  basTimezone: z.string().min(1, 'Timezone is required'),
  connectors: z
    .array(
      z.object({
        provider: z.string().min(1, 'Provider is required'),
        status: z.enum(['pending', 'configured', 'needs-approval'])
      })
    )
    .min(1, 'At least one connector is required')
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const defaultValues: OnboardingFormValues = {
  organisationName: '',
  registrationNumber: '',
  contactEmail: '',
  narrative: '',
  basFrequency: 'Monthly',
  basDay: '21',
  basTimezone: 'Australia/Sydney',
  connectors: [
    {
      provider: 'Xero Accounting',
      status: 'pending'
    }
  ]
};

type WizardStep = {
  id: 'organisation' | 'bas' | 'connectors';
  title: string;
  description: string;
};

const steps: WizardStep[] = [
  {
    id: 'organisation',
    title: 'Organisation profile',
    description: 'Legal metadata and narrative used for attestations.'
  },
  {
    id: 'bas',
    title: 'BAS schedule',
    description: 'Define the cadence of Business Activity Statements.'
  },
  {
    id: 'connectors',
    title: 'Connector readiness',
    description: 'Document integrations required to fetch evidence.'
  }
];

export function OnboardingWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onBlur',
    defaultValues
  });

  const currentStep = steps[currentStepIndex];
  const errors = form.formState.errors;

  const canContinue = useMemo(() => {
    switch (currentStep.id) {
      case 'organisation':
        return (
          !errors.organisationName &&
          !errors.registrationNumber &&
          !errors.contactEmail &&
          form.watch('organisationName') !== '' &&
          form.watch('registrationNumber') !== '' &&
          form.watch('contactEmail') !== ''
        );
      case 'bas':
        return !errors.basFrequency && !errors.basDay && !errors.basTimezone;
      case 'connectors':
        return !errors.connectors;
      default:
        return false;
    }
  }, [currentStep.id, errors, form]);

  const goNext = () => setCurrentStepIndex((step) => Math.min(step + 1, steps.length - 1));
  const goPrevious = () => setCurrentStepIndex((step) => Math.max(step - 1, 0));

  const handleSubmit = (values: OnboardingFormValues) => {
    console.table(values);
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="container" noValidate>
        <header>
          <h2 className="section-title">Onboarding wizard</h2>
          <p className="muted">
            Capture the organisation profile, BAS cycle, and integration inventory needed before
            first reconciliation.
          </p>
        </header>

        <ol className="wizard-progress" aria-label="Onboarding progress">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={
                index === currentStepIndex ? 'active' : index < currentStepIndex ? 'complete' : ''
              }
            >
              <span className="step-index" aria-hidden>
                {index + 1}
              </span>
              <div>
                <p className="step-title">{step.title}</p>
                <p className="muted step-description">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <Card>
          {currentStep.id === 'organisation' && <OrganisationStep />}
          {currentStep.id === 'bas' && <BasStep />}
          {currentStep.id === 'connectors' && <ConnectorsStep />}
        </Card>

        <div className="wizard-actions">
          <Button type="button" variant="ghost" onClick={goPrevious} disabled={currentStepIndex === 0}>
            Back
          </Button>
          {currentStepIndex < steps.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={!canContinue}>
              Continue
            </Button>
          ) : (
            <Button type="submit">Submit onboarding</Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}

function OrganisationStep() {
  const {
    register,
    formState: { errors }
  } = useFormContext<OnboardingFormValues>();

  return (
    <div className="form-grid">
      <FormField
        id="organisationName"
        label="Legal entity name"
        error={errors.organisationName?.message}
      >
        <Input id="organisationName" {...register('organisationName')} placeholder="Birchal Pty Ltd" />
      </FormField>

      <FormField
        id="registrationNumber"
        label="ABN / ACN"
        error={errors.registrationNumber?.message}
      >
        <Input
          id="registrationNumber"
          {...register('registrationNumber')}
          placeholder="12 345 678 910"
        />
      </FormField>

      <FormField id="contactEmail" label="Primary contact" error={errors.contactEmail?.message}>
        <Input
          id="contactEmail"
          type="email"
          {...register('contactEmail')}
          placeholder="ops@birchal.com"
        />
      </FormField>

      <FormField
        id="narrative"
        label="Control narrative"
        description="Summarise onboarding scope for auditors"
        error={errors.narrative?.message}
      >
        <Textarea
          id="narrative"
          {...register('narrative')}
          rows={4}
          placeholder="Outline roles, responsibilities, and any in-scope subsidiaries."
        />
      </FormField>
    </div>
  );
}

function BasStep() {
  const {
    register,
    formState: { errors }
  } = useFormContext<OnboardingFormValues>();

  return (
    <div className="form-grid two-columns">
      <FormField id="basFrequency" label="Filing frequency" error={errors.basFrequency?.message}>
        <Select id="basFrequency" {...register('basFrequency')}>
          <option value="Monthly">Monthly</option>
          <option value="Quarterly">Quarterly</option>
          <option value="Annually">Annually</option>
        </Select>
      </FormField>

      <FormField id="basDay" label="Due day" error={errors.basDay?.message}>
        <Input id="basDay" type="number" min={1} max={31} {...register('basDay')} />
      </FormField>

      <FormField
        id="basTimezone"
        label="Timezone"
        description="Used when generating lodgement reminders"
        error={errors.basTimezone?.message}
      >
        <Input id="basTimezone" {...register('basTimezone')} placeholder="Australia/Sydney" />
      </FormField>
    </div>
  );
}

function ConnectorsStep() {
  const {
    register,
    control,
    formState: { errors }
  } = useFormContext<OnboardingFormValues>();
  const connectors = useWatch({ control, name: 'connectors' });
  const connectorErrors = errors.connectors as
    | Array<ConnectorFieldError | undefined>
    | undefined;

  return (
    <div className="form-grid">
      {connectors?.map((connector, index) => (
        <ConnectorCard
          key={`${connector.provider}-${index}`}
          index={index}
          status={connector.status}
          register={register}
          errors={connectorErrors?.[index]}
        />
      ))}

      {typeof errors.connectors?.message === 'string' && (
        <p role="alert" className="error-text">
          {errors.connectors.message}
        </p>
      )}

      <p className="muted">
        Add additional connector stubs for payroll, payments, and ERP systems once integration briefs
        are agreed.
      </p>
    </div>
  );
}

type ConnectorFieldError = Partial<Record<'provider' | 'status', { message?: string }>>;

interface ConnectorCardProps {
  index: number;
  status: string;
  register: UseFormRegister<OnboardingFormValues>;
  errors?: ConnectorFieldError;
}

function ConnectorCard({ index, status, register, errors }: ConnectorCardProps) {
  const providerId = `connector-${index}-provider`;
  const statusId = `connector-${index}-status`;

  return (
    <Card
      header={<h3>Connector {index + 1}</h3>}
      footer={<span className="badge">{status.replace('-', ' ')}</span>}
    >
      <FormField id={providerId} label="Provider" error={errors?.provider?.message}>
        <Input {...register(`connectors.${index}.provider` as const)} placeholder="Xero Accounting" />
      </FormField>

      <FormField id={statusId} label="Status" error={errors?.status?.message}>
        <Select {...register(`connectors.${index}.status` as const)}>
          <option value="pending">Pending</option>
          <option value="configured">Configured</option>
          <option value="needs-approval">Needs approval</option>
        </Select>
      </FormField>
    </Card>
  );
}
