import { useRouter } from "@tanstack/react-router";
import React from "react";
import { useOnboarding } from "../../onboarding/OnboardingProvider";
import { getStepPath } from "../../onboarding/types";

const BANK_PROVIDER = "APGMS Demo Bank";

type ConsentStatus = "idle" | "pending" | "approved" | "declined";

export function OnboardingBankStep() {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const { data, updateSection } = useOnboarding();
  const router = useRouter();
  const [status, setStatus] = React.useState<ConsentStatus>(
    data.bank?.status ?? "idle"
  );
  const [announcement, setAnnouncement] = React.useState<string>("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  React.useEffect(() => {
    setStatus(data.bank?.status ?? "idle");
  }, [data.bank?.status]);

  React.useEffect(() => {
    if (isModalOpen) {
      modalRef.current?.focus();
    }
  }, [isModalOpen]);

  React.useEffect(() => {
    if (status !== "pending") {
      return;
    }

    const timer = window.setTimeout(() => {
      const consentId =
        data.bank?.consentId ?? `consent-${Math.random().toString(36).slice(2, 10)}`;
      const approved = {
        consentId,
        status: "approved" as const,
        provider: BANK_PROVIDER,
        approvedAt: new Date().toISOString(),
      };
      updateSection("bank", approved);
      setStatus("approved");
      setAnnouncement("PayTo consent approved.");
      setIsModalOpen(false);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [data.bank?.consentId, status, updateSection]);

  const launchConsent = React.useCallback(() => {
    const consentId =
      data.bank?.consentId ?? `consent-${Math.random().toString(36).slice(2, 10)}`;
    updateSection("bank", {
      consentId,
      status: "pending",
      provider: BANK_PROVIDER,
    });
    setStatus("pending");
    setIsModalOpen(true);
    setAnnouncement("PayTo consent launched in a new window.");
  }, [data.bank?.consentId, updateSection]);

  const cancelConsent = React.useCallback(() => {
    if (!data.bank?.consentId) {
      return;
    }
    updateSection("bank", {
      consentId: data.bank.consentId,
      status: "declined",
      provider: BANK_PROVIDER,
    });
    setStatus("declined");
    setIsModalOpen(false);
    setAnnouncement("Consent was cancelled. Start again when you're ready.");
  }, [data.bank, updateSection]);

  const handleNext = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (status !== "approved") {
        setAnnouncement("You must approve the PayTo consent to continue.");
        return;
      }
      await router.navigate({ to: getStepPath("policies") });
    },
    [router, status]
  );

  const handleBack = React.useCallback(() => {
    router.navigate({ to: getStepPath("org") }).catch(() => undefined);
  }, [router]);

  return (
    <form className="space-y-6" onSubmit={handleNext}>
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 focus:outline-none"
        >
          Connect your bank
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Launch a PayTo consent with your financial institution so we can
          confirm your ownership of the nominated account.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Consent status
            </dt>
            <dd
              className="mt-1 text-base font-medium"
              aria-live="polite"
              data-testid="consent-status"
            >
              {status === "idle" && "Not started"}
              {status === "pending" && "Awaiting customer approval"}
              {status === "approved" && "Approved"}
              {status === "declined" && "Declined"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Provider
            </dt>
            <dd className="mt-1 text-base font-medium">
              {data.bank?.provider ?? BANK_PROVIDER}
            </dd>
          </div>
        </dl>
        {announcement ? (
          <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700" role="status">
            {announcement}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={launchConsent}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            Launch PayTo consent
          </button>
          {status === "pending" ? (
            <button
              type="button"
              onClick={cancelConsent}
              className="text-sm font-semibold text-red-600 underline"
            >
              Cancel consent
            </button>
          ) : null}
        </div>
      </div>
      {isModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-dialog-title"
          aria-describedby="consent-dialog-description"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl focus:outline-none"
          >
            <h4
              id="consent-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              Approve PayTo consent
            </h4>
            <p
              id="consent-dialog-description"
              className="mt-2 text-sm text-slate-600"
            >
              You are being redirected to {BANK_PROVIDER}. Approve the consent to
              allow APGMS to collect settlement funds when policies trigger.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                onClick={() => {
                  setIsModalOpen(false);
                  setStatus("idle");
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                onClick={() => {
                  const consentId =
                    data.bank?.consentId ??
                    `consent-${Math.random().toString(36).slice(2, 10)}`;
                  updateSection("bank", {
                    consentId,
                    status: "approved",
                    provider: BANK_PROVIDER,
                    approvedAt: new Date().toISOString(),
                  });
                  setStatus("approved");
                  setIsModalOpen(false);
                  setAnnouncement("Consent approved successfully.");
                }}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
          disabled={status !== "approved"}
        >
          Continue to policies
        </button>
      </div>
    </form>
  );
}
