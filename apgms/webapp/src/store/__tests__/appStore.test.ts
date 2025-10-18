import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppStore, createInitialState } from '../appStore';

const createResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });

describe('appStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState(createInitialState());
  });

  it('signs users in and loads portal data', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        createResponse({
          token: 'token-123',
          user: { id: 'user-1', email: 'user@example.com', organisation: 'APGMS' }
        })
      )
      .mockResolvedValueOnce(
        createResponse({ id: 'user-1', email: 'user@example.com', organisation: 'APGMS' })
      )
      .mockResolvedValueOnce(
        createResponse([
          {
            id: 'kyc',
            title: 'Complete KYC',
            description: 'Collect director IDs.',
            status: 'in-progress'
          }
        ])
      )
      .mockResolvedValueOnce(
        createResponse([
          {
            id: 'gst-1',
            jurisdiction: 'Australia',
            filingType: 'GST monthly',
            dueDate: '2024-12-01',
            status: 'in-progress',
            owner: 'Jamie Lee'
          }
        ])
      )
      .mockResolvedValueOnce(
        createResponse([
          { id: 'filings', label: 'Filings submitted', value: '85%', trend: 'up' }
        ])
      )
      .mockResolvedValueOnce(
        createResponse([
          {
            id: 'late-fee',
            title: 'Late fee waiver',
            description: 'Confirm waiver approval.',
            severity: 'medium',
            acknowledged: false
          }
        ])
      );

    await useAppStore.getState().signIn('user@example.com', 'password');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.anything());
    expect(useAppStore.getState().user?.email).toBe('user@example.com');
    expect(useAppStore.getState().taxWorkflows).toHaveLength(1);
    expect(useAppStore.getState().complianceNotices[0].id).toBe('late-fee');
  });

  it('updates onboarding step status', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(createResponse({
        id: 'banking',
        title: 'Banking integration',
        description: 'Connect treasury accounts.',
        status: 'complete'
      }));

    useAppStore.setState((state) => ({
      ...state,
      onboardingSteps: [
        {
          id: 'banking',
          title: 'Banking integration',
          description: 'Connect treasury accounts.',
          status: 'in-progress'
        }
      ]
    }));

    await useAppStore.getState().updateOnboardingStep('banking', 'complete');

    expect(useAppStore.getState().onboardingSteps[0].status).toBe('complete');
  });
});
