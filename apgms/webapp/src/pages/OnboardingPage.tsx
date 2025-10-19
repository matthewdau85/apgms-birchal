import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

const steps = [
  {
    id: 'company',
    title: 'Company details',
    description: 'Verify your legal entity and share registry information.',
  },
  {
    id: 'directors',
    title: 'Director verification',
    description: 'Collect KYC information and confirm director appointments.',
  },
  {
    id: 'facilities',
    title: 'Link facilities',
    description: 'Connect banking facilities and assign treasury owners.',
  },
  {
    id: 'controls',
    title: 'Control review',
    description: 'Configure approval workflows and treasury controls.',
  },
] as const;

const OnboardingPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const progressText = useMemo(() => `Step ${currentStep + 1} of ${steps.length}`, [currentStep]);

  const goNext = () => setCurrentStep((stepIndex) => Math.min(stepIndex + 1, steps.length - 1));
  const goBack = () => setCurrentStep((stepIndex) => Math.max(stepIndex - 1, 0));

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Onboarding</h1>
        <p style={{ color: 'var(--muted)' }}>Complete the following steps to activate treasury automations.</p>
      </header>
      <button type="button" onClick={() => setIsOpen(true)} aria-haspopup="dialog">
        Launch onboarding wizard
      </button>
      {isOpen ? (
        <div className="onboarding-dialog" role="presentation" onClick={() => setIsOpen(false)}>
          <div
            className="onboarding-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            onClick={(event) => event.stopPropagation()}
            ref={dialogRef}
          >
            <header>
              <div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>{progressText}</p>
                <h2 id="onboarding-title" style={{ marginTop: '0.35rem' }}>
                  {steps[currentStep].title}
                </h2>
              </div>
              <button type="button" className="close" aria-label="Exit onboarding" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </header>
            <p>{steps[currentStep].description}</p>
            <ul className="stepper" role="tablist" aria-label="Onboarding progress">
              {steps.map((step, index) => (
                <li key={step.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={index === currentStep}
                    aria-current={index === currentStep ? 'step' : undefined}
                    onClick={() => setCurrentStep(index)}
                  >
                    {index + 1}. {step.title}
                  </button>
                </li>
              ))}
            </ul>
            <form aria-live="polite">
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="sr-only">{steps[currentStep].title}</legend>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <label>
                    <span style={{ display: 'block', marginBottom: '0.4rem' }}>Owner</span>
                    <input type="text" placeholder="Name" required aria-required="true" />
                  </label>
                  <label>
                    <span style={{ display: 'block', marginBottom: '0.4rem' }}>Notes</span>
                    <textarea placeholder="Add context for this step" rows={3} />
                  </label>
                </div>
              </fieldset>
            </form>
            <div className="onboarding-actions">
              <button type="button" onClick={goBack} disabled={currentStep === 0}>
                Back
              </button>
              {currentStep === steps.length - 1 ? (
                <button type="button" onClick={() => setIsOpen(false)}>
                  Finish
                </button>
              ) : (
                <button type="button" onClick={goNext}>
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default OnboardingPage;
