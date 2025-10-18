export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  organisation: string;
  name?: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete';
}

export interface TaxWorkflow {
  id: string;
  jurisdiction: string;
  filingType: string;
  dueDate: string;
  status: 'draft' | 'in-progress' | 'filed' | 'awaiting-review';
  owner: string;
}

export interface ComplianceMetric {
  id: string;
  label: string;
  value: string;
  trend: 'up' | 'down' | 'steady';
}

export interface ComplianceNotice {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  acknowledged: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

export class ApiGatewayClient {
  constructor(private readonly getToken: () => string | null) {}

  private buildHeaders(headers?: HeadersInit): HeadersInit {
    const token = this.getToken();
    return {
      ...jsonHeaders,
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: this.buildHeaders(init?.headers)
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = await response.json();
        message = payload.message ?? message;
      } catch (error) {
        // ignore JSON parsing failures
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  login(email: string, password: string) {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  fetchProfile() {
    return this.request<UserProfile>('/auth/profile');
  }

  fetchOnboardingSteps() {
    return this.request<OnboardingStep[]>('/onboarding/steps');
  }

  updateOnboardingStep(stepId: string, status: OnboardingStep['status']) {
    return this.request<OnboardingStep>(`/onboarding/steps/${stepId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  fetchTaxWorkflows() {
    return this.request<TaxWorkflow[]>('/tax/workflows');
  }

  fetchComplianceMetrics() {
    return this.request<ComplianceMetric[]>('/compliance/metrics');
  }

  fetchComplianceNotices() {
    return this.request<ComplianceNotice[]>('/compliance/notices');
  }
}
