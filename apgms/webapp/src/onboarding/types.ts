export type OnboardingStep = "org" | "bank" | "policies" | "integrations" | "review";

export interface OnboardingDraftData {
  org?: {
    name: string;
    abn: string;
    address: string;
  };
  bank?: {
    consentId: string;
    status: "pending" | "approved" | "declined";
    provider?: string;
    approvedAt?: string;
  };
  policies?: {
    templateId: string;
    allocations: {
      operating: number;
      tax: number;
      paygw: number;
      gst: number;
    };
  };
  integrations?: {
    xero?: boolean;
    qbo?: boolean;
    square?: boolean;
  };
  status?: string;
  completedAt?: string;
}

export interface OnboardingStepDefinition {
  id: OnboardingStep;
  name: string;
  description: string;
}

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    id: "org",
    name: "Organisation",
    description: "Tell us about your organisation",
  },
  {
    id: "bank",
    name: "Bank",
    description: "Connect a PayTo consent",
  },
  {
    id: "policies",
    name: "Policies",
    description: "Choose how we allocate your inflows",
  },
  {
    id: "integrations",
    name: "Integrations",
    description: "Connect your business tools",
  },
  {
    id: "review",
    name: "Review",
    description: "Confirm and finish onboarding",
  },
];

export function getStepPath(step: OnboardingStep): string {
  return `/onboarding/${step}`;
}

export function getStepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.findIndex((definition) => definition.id === step);
}
