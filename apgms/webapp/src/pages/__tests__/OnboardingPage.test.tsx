import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { renderWithRouter } from '../../test-utils';
import { createInitialState, useAppStore } from '../../store/appStore';
import { OnboardingPage } from '../OnboardingPage';

describe('OnboardingPage', () => {
  beforeEach(() => {
    useAppStore.setState(() => ({
      ...createInitialState(),
      onboardingSteps: [
        {
          id: 'banking',
          title: 'Connect banking',
          description: 'Link the primary treasury accounts for reconciliations.',
          status: 'pending'
        }
      ],
      updateOnboardingStep: vi.fn()
    }));
  });

  it('renders onboarding steps with actions', () => {
    renderWithRouter(<OnboardingPage />);

    expect(screen.getByText(/connect banking/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /start step/i })).toBeVisible();
  });

  it('invokes update handler when advancing step', () => {
    renderWithRouter(<OnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: /start step/i }));

    expect(useAppStore.getState().updateOnboardingStep).toHaveBeenCalledWith(
      'banking',
      'in-progress'
    );
  });
});
