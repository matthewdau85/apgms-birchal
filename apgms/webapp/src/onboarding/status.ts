import type { OnboardingDraftData, OnboardingStep } from "./types";
import { ONBOARDING_STEPS } from "./types";

export function isStepComplete(step: OnboardingStep, data: OnboardingDraftData): boolean {
  switch (step) {
    case "org":
      return Boolean(data.org?.name && data.org?.abn && data.org?.address);
    case "bank":
      return data.bank?.status === "approved";
    case "policies":
      return Boolean(data.policies?.templateId);
    case "integrations":
      return true;
    case "review":
      return data.status === "completed";
    default:
      return false;
  }
}

export function arePriorStepsComplete(step: OnboardingStep, data: OnboardingDraftData): boolean {
  const stepIndex = ONBOARDING_STEPS.findIndex((definition) => definition.id === step);
  if (stepIndex <= 0) {
    return true;
  }
  return ONBOARDING_STEPS.slice(0, stepIndex).every((definition) =>
    isStepComplete(definition.id, data)
  );
}
