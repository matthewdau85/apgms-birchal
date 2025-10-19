import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { clsx } from "clsx";
import React from "react";
import { OnboardingProvider, useOnboarding } from "../../onboarding/OnboardingProvider";
import {
  ONBOARDING_STEPS,
  OnboardingStep,
  getStepIndex,
  getStepPath,
} from "../../onboarding/types";
import { arePriorStepsComplete, isStepComplete } from "../../onboarding/status";

export function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <OnboardingShell />
    </OnboardingProvider>
  );
}

function OnboardingShell() {
  const { data, isSaving, lastSavedAt, error, clearError } = useOnboarding();
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const pathname = location.pathname ?? "/onboarding/org";

  const currentDefinition =
    ONBOARDING_STEPS.find((step) => pathname.endsWith(`/${step.id}`)) ??
    ONBOARDING_STEPS[0];
  const currentIndex = Math.max(getStepIndex(currentDefinition.id), 0);

  const formatSavedAt = React.useCallback(() => {
    if (!lastSavedAt) {
      return null;
    }
    try {
      const date = new Date(lastSavedAt);
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
    } catch (formatError) {
      return lastSavedAt;
    }
  }, [lastSavedAt]);

  const handleNavigate = React.useCallback(
    (step: OnboardingStep) => {
      if (step === currentDefinition.id) {
        return;
      }
      router.navigate({ to: getStepPath(step) }).catch(() => {
        // ignore navigation errors, router will handle invalid routes
      });
    },
    [currentDefinition.id, router]
  );

  const savedAtText = formatSavedAt();

  return (
    <div className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-2xl font-semibold text-slate-900" tabIndex={-1}>
          New account onboarding
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Complete each step to activate your account, connect your bank, and
          configure default cash flow policies.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span
            className={clsx(
              "font-medium",
              isSaving ? "text-blue-600" : "text-emerald-600"
            )}
            role="status"
            aria-live="polite"
          >
            {isSaving ? "Saving draft…" : "Draft saved"}
          </span>
          {!isSaving && savedAtText ? (
            <span className="text-slate-500">Last saved at {savedAtText}</span>
          ) : null}
        </div>
        {error ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <span className="font-medium">{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="ml-auto text-xs font-semibold uppercase tracking-wide text-red-600 underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
      <nav aria-label="Onboarding steps" className="border-b border-slate-200 px-4 py-4">
        <ol className="grid gap-2 sm:grid-cols-5">
          {ONBOARDING_STEPS.map((step, index) => {
            const complete = isStepComplete(step.id, data);
            const enabled =
              index <= currentIndex || arePriorStepsComplete(step.id, data);
            const isCurrent = step.id === currentDefinition.id;
            return (
              <li key={step.id} className="flex">
                <button
                  type="button"
                  onClick={() => handleNavigate(step.id)}
                  disabled={!enabled}
                  className={clsx(
                    "flex w-full flex-col rounded-md border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500",
                    enabled
                      ? "border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
                    isCurrent &&
                      "border-blue-500 bg-blue-50 text-blue-700 shadow-inner",
                    complete && !isCurrent && "border-emerald-300 bg-emerald-50"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                    {step.name}
                    <span aria-hidden="true">
                      {complete ? "✓" : index + 1}
                    </span>
                  </span>
                  <span className="mt-1 text-xs text-slate-600">
                    {step.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="px-6 py-6">
        <Outlet />
      </div>
    </div>
  );
}
