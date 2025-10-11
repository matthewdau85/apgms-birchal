import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DEFAULT_ONBOARDING_STEP, ONBOARDING_STEPS, type OnboardingStepId } from '@/routes/config';

const STEP_CONTENT: Record<OnboardingStepId, { heading: string; description: string; checklist: string[] }> = {
  welcome: {
    heading: 'Kick off your onboarding',
    description: 'Learn how APGMS guides your BAS, reconciliation, and audit readiness.',
    checklist: ['Review onboarding roadmap', 'Meet your implementation partner']
  },
  organization: {
    heading: 'Confirm organisation profile',
    description: 'We use this information for filings and reporting outputs.',
    checklist: ['Verify legal entity details', 'Upload trust deed and corporate docs']
  },
  compliance: {
    heading: 'Define compliance scope',
    description: 'Select frameworks, lodgements, and obligations for automation.',
    checklist: ['Choose ATO and payroll requirements', 'Add industry-specific obligations']
  },
  team: {
    heading: 'Invite your team',
    description: 'Ensure stakeholders receive the right notifications and tasks.',
    checklist: ['Add finance owners and reviewers', 'Assign access levels']
  },
  integrations: {
    heading: 'Connect integrations',
    description: 'Securely link accounting and evidence systems for data sync.',
    checklist: ['Connect Xero or MYOB', 'Authorise document storage provider']
  },
  review: {
    heading: 'Review & launch',
    description: 'Validate that everything looks correct before going live.',
    checklist: ['Check onboarding progress summary', 'Schedule go-live session']
  }
};

export function OnboardingWizardPage() {
  const { stepId = DEFAULT_ONBOARDING_STEP } = useParams<{ stepId: OnboardingStepId }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const currentStep = useMemo<OnboardingStepId>(() => {
    return ONBOARDING_STEPS.includes(stepId) ? stepId : DEFAULT_ONBOARDING_STEP;
  }, [stepId]);

  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
  const completion = ((currentIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const goToStep = (index: number) => {
    const nextStep = ONBOARDING_STEPS[index];
    if (nextStep) {
      navigate(`/onboarding/${nextStep}`);
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('onboarding.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t(`onboarding.steps.${currentStep}.name`)}</CardTitle>
          <CardDescription>{t(`onboarding.steps.${currentStep}.description`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Step {currentIndex + 1} of {ONBOARDING_STEPS.length}</p>
            <Progress value={completion} aria-label={`Onboarding progress ${Math.round(completion)} percent`} />
          </div>
          <section aria-labelledby="onboarding-checklist" className="space-y-3">
            <h2 id="onboarding-checklist" className="text-sm font-semibold text-foreground">
              {STEP_CONTENT[currentStep].heading}
            </h2>
            <p className="text-sm text-muted-foreground">{STEP_CONTENT[currentStep].description}</p>
            <ul className="space-y-2 text-sm">
              {STEP_CONTENT[currentStep].checklist.map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
          <div className="flex flex-wrap justify-between gap-3">
            <Button type="button" variant="outline" disabled={currentIndex === 0} onClick={() => goToStep(currentIndex - 1)}>
              {t('onboarding.actions.back')}
            </Button>
            {currentIndex === ONBOARDING_STEPS.length - 1 ? (
              <Button type="button">{t('onboarding.actions.finish')}</Button>
            ) : (
              <Button type="button" onClick={() => goToStep(currentIndex + 1)}>
                {t('onboarding.actions.next')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
