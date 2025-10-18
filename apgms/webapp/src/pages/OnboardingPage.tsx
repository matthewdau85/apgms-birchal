import { useMemo } from 'react';

import { StatusBadge } from '../components/ui/StatusBadge';
import { useAppStore } from '../store/appStore';

const statusCopy = {
  pending: { label: 'Pending', tone: 'default' },
  'in-progress': { label: 'In progress', tone: 'warning' },
  complete: { label: 'Complete', tone: 'success' }
} as const;

export const OnboardingPage = () => {
  const { onboardingSteps, updateOnboardingStep } = useAppStore((state) => ({
    onboardingSteps: state.onboardingSteps,
    updateOnboardingStep: state.updateOnboardingStep
  }));

  const sortedSteps = useMemo(
    () =>
      [...onboardingSteps].sort((stepA, stepB) => {
        const priority = { pending: 0, 'in-progress': 1, complete: 2 } as const;
        return priority[stepA.status] - priority[stepB.status];
      }),
    [onboardingSteps]
  );

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1>Onboarding journey</h1>
          <p>
            Track progress across tax registrations, banking connections, and compliance approvals
            as you bring a new organisation onto the platform.
          </p>
        </div>
      </header>

      <section className="panel">
        {sortedSteps.length === 0 ? (
          <p>No onboarding steps have been configured yet.</p>
        ) : (
          <ol className="onboarding-list">
            {sortedSteps.map((step) => {
              const { label, tone } = statusCopy[step.status];
              return (
                <li key={step.id} className="onboarding-list__item">
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                  <div className="onboarding-list__meta">
                    <StatusBadge label={label} tone={tone} />
                    {step.status !== 'complete' && (
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() =>
                          updateOnboardingStep(
                            step.id,
                            step.status === 'pending' ? 'in-progress' : 'complete'
                          )
                        }
                      >
                        {step.status === 'pending' ? 'Start step' : 'Mark complete'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
};
