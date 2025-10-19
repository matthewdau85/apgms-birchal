import { useRouter } from "@tanstack/react-router";
import React from "react";
import { useOnboarding } from "../../onboarding/OnboardingProvider";
import { getStepPath } from "../../onboarding/types";

interface IntegrationOption {
  id: "xero" | "qbo" | "square";
  name: string;
  description: string;
}

const INTEGRATIONS: IntegrationOption[] = [
  {
    id: "xero",
    name: "Xero",
    description: "Sync contacts, invoices, and chart of accounts from your Xero ledger.",
  },
  {
    id: "qbo",
    name: "QuickBooks Online",
    description: "Mirror AP and AR activity to QuickBooks for effortless reconciliation.",
  },
  {
    id: "square",
    name: "Square",
    description: "Pull point-of-sale settlements and fees to keep allocations balanced.",
  },
];

export function OnboardingIntegrationsStep() {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const { data, updateSection } = useOnboarding();
  const router = useRouter();
  const [connecting, setConnecting] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string>("");

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const handleConnect = React.useCallback(
    (integration: IntegrationOption) => {
      setConnecting(integration.id);
      setMessage("");
      window.setTimeout(() => {
        const next = {
          ...(data.integrations ?? {}),
          [integration.id]: true,
        } as NonNullable<typeof data.integrations>;
        updateSection("integrations", next);
        setConnecting(null);
        setMessage(`${integration.name} connected successfully.`);
      }, 800);
    },
    [data.integrations, updateSection]
  );

  const isConnected = React.useCallback(
    (integration: IntegrationOption) => Boolean(data.integrations?.[integration.id]),
    [data.integrations]
  );

  const handleNext = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      await router.navigate({ to: getStepPath("review") });
    },
    [router]
  );

  const handleBack = React.useCallback(() => {
    router.navigate({ to: getStepPath("policies") }).catch(() => undefined);
  }, [router]);

  return (
    <form className="space-y-6" onSubmit={handleNext}>
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 focus:outline-none"
        >
          Connect optional integrations
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Link your accounting or point-of-sale systems to automate policy
          triggers. You can always connect more integrations later.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {INTEGRATIONS.map((integration) => {
          const connected = isConnected(integration);
          const pending = connecting === integration.id;
          return (
            <article
              key={integration.id}
              className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              aria-live="polite"
            >
              <div className="flex flex-1 flex-col">
                <h4 className="text-base font-semibold text-slate-900">
                  {integration.name}
                </h4>
                <p className="mt-2 text-sm text-slate-600">
                  {integration.description}
                </p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleConnect(integration)}
                  disabled={pending || connected}
                  className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  {connected ? "Connected" : pending ? "Connecting…" : "Connect"}
                </button>
                {connected ? (
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-emerald-600">
                    Connected
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {message ? (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700" role="status">
          {message}
        </p>
      ) : null}
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Prefer to skip for now? You can finish onboarding without connecting
        integrations and add them later from settings.
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="text-sm font-semibold text-slate-600 underline"
        >
          Back
        </button>
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Continue to review
        </button>
      </div>
    </form>
  );
}
