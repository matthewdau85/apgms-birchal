import { create } from 'zustand';

import {
  ApiGatewayClient,
  ComplianceMetric,
  ComplianceNotice,
  OnboardingStep,
  TaxWorkflow,
  UserProfile
} from '../services/api';

const TOKEN_STORAGE_KEY = 'apgms:webapp:token';

const readToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

const persistToken = (token: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export interface AppState {
  authToken: string | null;
  user: UserProfile | null;
  onboardingSteps: OnboardingStep[];
  taxWorkflows: TaxWorkflow[];
  complianceMetrics: ComplianceMetric[];
  complianceNotices: ComplianceNotice[];
  isBootstrapping: boolean;
  error: string | null;
}

interface AppActions {
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  isAuthenticated: () => boolean;
  updateOnboardingStep: (stepId: string, status: OnboardingStep['status']) => Promise<void>;
  acknowledgeNotice: (noticeId: string) => void;
}

type AppStore = AppState & AppActions;

export const createInitialState = (): AppState => ({
  authToken: null,
  user: null,
  onboardingSteps: [],
  taxWorkflows: [],
  complianceMetrics: [],
  complianceNotices: [],
  isBootstrapping: false,
  error: null
});

export const useAppStore = create<AppStore>((set, get) => {
  const api = new ApiGatewayClient(() => get().authToken);

  const loadPortalData = async () => {
    set({ isBootstrapping: true, error: null });
    try {
      const [user, onboardingSteps, taxWorkflows, complianceMetrics, complianceNotices] =
        await Promise.all([
          api.fetchProfile(),
          api.fetchOnboardingSteps(),
          api.fetchTaxWorkflows(),
          api.fetchComplianceMetrics(),
          api.fetchComplianceNotices()
        ]);

      set({
        user,
        onboardingSteps,
        taxWorkflows,
        complianceMetrics,
        complianceNotices,
        isBootstrapping: false,
        error: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load workspace data';
      set({ error: message, isBootstrapping: false });
      throw error;
    }
  };

  return {
    ...createInitialState(),

    bootstrap: async () => {
      const { authToken } = get();
      if (!authToken) {
        const storedToken = readToken();
        if (!storedToken) {
          return;
        }
        set({ authToken: storedToken });
      }

      if (get().user) {
        return;
      }

      try {
        await loadPortalData();
      } catch (error) {
        // loadPortalData already captured error state
      }
    },

    signIn: async (email, password) => {
      set({ error: null, isBootstrapping: true });
      try {
        const response = await api.login(email, password);
        persistToken(response.token);
        set({ authToken: response.token, user: response.user });
        await loadPortalData();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'We were unable to sign you in';
        set({ error: message, isBootstrapping: false });
        throw error;
      }
    },

    signOut: () => {
      persistToken(null);
      set(createInitialState());
    },

    isAuthenticated: () => Boolean(get().authToken ?? readToken()),

    updateOnboardingStep: async (stepId, status) => {
      try {
        const updatedStep = await api.updateOnboardingStep(stepId, status);
        set((state) => ({
          onboardingSteps: state.onboardingSteps.map((step) =>
            step.id === stepId ? updatedStep : step
          )
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to update onboarding step';
        set({ error: message });
        throw error;
      }
    },

    acknowledgeNotice: (noticeId) => {
      set((state) => ({
        complianceNotices: state.complianceNotices.map((notice) =>
          notice.id === noticeId ? { ...notice, acknowledged: true } : notice
        )
      }));
    }
  };
});
