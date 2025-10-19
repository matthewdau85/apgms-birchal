import { useRouter } from "@tanstack/react-router";
import React from "react";
import { useOnboarding } from "../../onboarding/OnboardingProvider";
import { getStepPath, ONBOARDING_STEPS } from "../../onboarding/types";
import { isStepComplete } from "../../onboarding/status";

export function OnboardingReviewStep() {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const { data, complete, completion, isSaving } = useOnboarding();
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (completion) {
      setSuccessMessage(
        `Onboarding completed at ${new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(completion.completedAt))}`
      );
    }
  }, [completion]);

  const navigateTo = React.useCallback(
    (step: (typeof ONBOARDING_STEPS)[number]["id"]) => {
      router.navigate({ to: getStepPath(step) }).catch(() => undefined);
    },
    [router]
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const result = await complete();
        setSuccessMessage(
          `Onboarding completed at ${new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(result.completedAt))}`
        );
      } catch (submissionError) {
        setError("We couldn't finish onboarding. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [complete]
  );

  const org = data.org;
  const bank = data.bank;
  const policies = data.policies;
  const integrations = data.integrations ?? {};

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 focus:outline-none"
        >
          Review and finish
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Confirm your onboarding details. You can edit any section before
          finalising.
        </p>
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {successMessage ? (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {successMessage}
        </div>
      ) : null}
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-slate-900">Organisation</h4>
          <button
            type="button"
            className="text-sm font-semibold text-blue-600 underline"
            onClick={() => navigateTo("org")}
          >
            Edit
          </button>
        </header>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Name
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {org?.name ?? "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              ABN
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {org?.abn ?? "Not provided"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Address
            </dt>
            <dd className="mt-1 text-sm text-slate-900 whitespace-pre-line">
              {org?.address ?? "Not provided"}
            </dd>
          </div>
        </dl>
      </section>
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-slate-900">Bank consent</h4>
          <button
            type="button"
            className="text-sm font-semibold text-blue-600 underline"
            onClick={() => navigateTo("bank")}
          >
            Edit
          </button>
        </header>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {bank?.status ?? "Not started"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Consent ID
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {bank?.consentId ?? "Pending"}
            </dd>
          </div>
        </dl>
      </section>
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-slate-900">Policies</h4>
          <button
            type="button"
            className="text-sm font-semibold text-blue-600 underline"
            onClick={() => navigateTo("policies")}
          >
            Edit
          </button>
        </header>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {policies ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              <li>
                <span className="font-medium text-slate-900">Template</span>
                <p>{policies.templateId}</p>
              </li>
              <li>
                <span className="font-medium text-slate-900">Operating</span>
                <p>{policies.allocations.operating}%</p>
              </li>
              <li>
                <span className="font-medium text-slate-900">Tax</span>
                <p>{policies.allocations.tax}%</p>
              </li>
              <li>
                <span className="font-medium text-slate-900">PAYGW</span>
                <p>{policies.allocations.paygw}%</p>
              </li>
              <li>
                <span className="font-medium text-slate-900">GST</span>
                <p>{policies.allocations.gst}%</p>
              </li>
            </ul>
          ) : (
            <p>No policy selected.</p>
          )}
        </div>
      </section>
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-slate-900">Integrations</h4>
          <button
            type="button"
            className="text-sm font-semibold text-blue-600 underline"
            onClick={() => navigateTo("integrations")}
          >
            Edit
          </button>
        </header>
        <ul className="grid gap-2 sm:grid-cols-3">
          {Object.entries(integrations).length > 0 ? (
            Object.entries(integrations).map(([key, value]) => (
              <li
                key={key}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                {key.toUpperCase()}: {value ? "Connected" : "Pending"}
              </li>
            ))
          ) : (
            <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No integrations connected yet.
            </li>
          )}
        </ul>
      </section>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigateTo("integrations")}
          className="text-sm font-semibold text-slate-600 underline"
        >
          Back
        </button>
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={submitting || isSaving || !isStepComplete("bank", data) || !isStepComplete("policies", data) || !isStepComplete("org", data)}
        >
          {submitting ? "Finishing…" : "Finish onboarding"}
        </button>
      </div>
    </form>
  );
}
