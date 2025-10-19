import { createRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { rootRoute } from "../__root";
import { useAuth } from "../../lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { z } from "zod";

const profileSchema = z.object({
  legalName: z.string().min(1, "Legal name is required"),
  abn: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email"),
});

const bankSchema = z.object({
  bsb: z.string().regex(/^[0-9]{6}$/u, "BSB must be 6 digits"),
  acc: z.string().regex(/^[0-9]{6,9}$/u, "Account number must be 6-9 digits"),
});

const policySchema = z.object({
  policyId: z.string().min(1, "Select a policy"),
});

type OnboardingState = {
  profile?: z.infer<typeof profileSchema>;
  bank?: {
    bsbMasked: string;
    accMasked: string;
  };
  policyId?: string;
};

type Step = {
  id: "profile" | "bank" | "policy" | "confirm";
  label: string;
  description: string;
};

const steps: Step[] = [
  { id: "profile", label: "Org Profile", description: "Tell us about your organisation." },
  { id: "bank", label: "Bank Connect", description: "Securely connect your payout details." },
  { id: "policy", label: "Policy Select", description: "Choose the right policy for you." },
  { id: "confirm", label: "Confirm", description: "Review and confirm your information." },
];

const initialProfileState = { legalName: "", abn: "", contactEmail: "" };
const initialBankState = { bsb: "", acc: "" };

export const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: OnboardingPage,
});

function OnboardingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, navigate]);

  const { data: onboardingState } = useQuery({
    queryKey: ["onboarding", "state"],
    queryFn: async () => {
      const response = await api.get<{ state: OnboardingState }>("/onboarding");
      return response.data.state;
    },
  });

  const { data: policiesData } = useQuery({
    queryKey: ["policies"],
    queryFn: async () => {
      const response = await api.get<{ policies: { id: string; name: string; description: string }[] }>("/policies");
      return response.data.policies;
    },
  });

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [furthestStep, setFurthestStep] = useState<number>(0);

  const [profileForm, setProfileForm] = useState(() => ({
    ...initialProfileState,
    ...(onboardingState?.profile ?? {}),
  }));

  const [bankForm, setBankForm] = useState(() => ({ ...initialBankState }));
  const [policySelection, setPolicySelection] = useState(() => onboardingState?.policyId ?? "");

  useEffect(() => {
    if (onboardingState?.profile) {
      setProfileForm((prev) => ({
        ...prev,
        ...onboardingState.profile!,
        abn: onboardingState.profile?.abn ?? "",
      }));
      setFurthestStep((prev) => Math.max(prev, 1));
    }
    if (onboardingState?.bank) {
      setFurthestStep((prev) => Math.max(prev, 2));
    }
    if (onboardingState?.policyId) {
      setPolicySelection(onboardingState.policyId);
      setFurthestStep((prev) => Math.max(prev, 3));
    }
  }, [onboardingState]);

  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [bankErrors, setBankErrors] = useState<Record<string, string>>({});
  const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({});

  const profileMutation = useMutation({
    mutationFn: async (payload: typeof profileForm) => {
      const parsed = profileSchema.parse(payload);
      const response = await api.patch<{ profile: OnboardingState["profile"] }>("/onboarding/profile", parsed);
      return response.data.profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["onboarding", "state"], (prev: OnboardingState | undefined) => ({
        ...(prev ?? {}),
        profile: profile ?? undefined,
      }));
    },
  });

  const bankMutation = useMutation({
    mutationFn: async (payload: typeof bankForm) => {
      const parsed = bankSchema.parse(payload);
      const response = await api.post<{ bank: OnboardingState["bank"] }>("/onboarding/bank", parsed);
      return response.data.bank;
    },
    onSuccess: (bank) => {
      queryClient.setQueryData(["onboarding", "state"], (prev: OnboardingState | undefined) => ({
        ...(prev ?? {}),
        bank: bank ?? undefined,
      }));
    },
  });

  const policyMutation = useMutation({
    mutationFn: async (payload: { policyId: string }) => {
      const parsed = policySchema.parse(payload);
      const response = await api.post<{ policyId: string }>("/onboarding/policy", parsed);
      return response.data.policyId;
    },
    onSuccess: (policyId) => {
      queryClient.setQueryData(["onboarding", "state"], (prev: OnboardingState | undefined) => ({
        ...(prev ?? {}),
        policyId,
      }));
    },
  });

  const handleProfileNext = async () => {
    try {
      setProfileErrors({});
      await profileMutation.mutateAsync(profileForm);
      setCurrentStep(1);
      setFurthestStep((prev) => Math.max(prev, 1));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted: Record<string, string> = {};
        error.issues.forEach((issue) => {
          const key = issue.path[0];
          if (typeof key === "string") {
            formatted[key] = issue.message;
          }
        });
        setProfileErrors(formatted);
      }
    }
  };

  const handleBankNext = async () => {
    try {
      setBankErrors({});
      await bankMutation.mutateAsync(bankForm);
      setCurrentStep(2);
      setFurthestStep((prev) => Math.max(prev, 2));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted: Record<string, string> = {};
        error.issues.forEach((issue) => {
          const key = issue.path[0];
          if (typeof key === "string") {
            formatted[key] = issue.message;
          }
        });
        setBankErrors(formatted);
      }
    }
  };

  const handlePolicyNext = async () => {
    try {
      setPolicyErrors({});
      await policyMutation.mutateAsync({ policyId: policySelection });
      setCurrentStep(3);
      setFurthestStep((prev) => Math.max(prev, 3));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formatted: Record<string, string> = {};
        error.issues.forEach((issue) => {
          const key = issue.path[0];
          if (typeof key === "string") {
            formatted[key] = issue.message;
          }
        });
        setPolicyErrors(formatted);
      }
    }
  };

  const handleStepKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(furthestStep, index + 1);
      setCurrentStep(next);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prev = Math.max(0, index - 1);
      setCurrentStep(prev);
    }
  };

  const stepContent = useMemo(() => {
    switch (steps[currentStep]?.id) {
      case "profile":
        return (
          <form className="grid gap-4" aria-labelledby="onboarding-profile">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="legalName">
                Legal name
              </label>
              <input
                id="legalName"
                name="legalName"
                type="text"
                value={profileForm.legalName}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, legalName: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-invalid={Boolean(profileErrors.legalName)}
              />
              {profileErrors.legalName ? (
                <p className="mt-1 text-sm text-rose-600" role="alert">
                  {profileErrors.legalName}
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="abn">
                ABN <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="abn"
                name="abn"
                type="text"
                value={profileForm.abn}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, abn: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-invalid={Boolean(profileErrors.abn)}
              />
              {profileErrors.abn ? (
                <p className="mt-1 text-sm text-rose-600" role="alert">
                  {profileErrors.abn}
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="contactEmail">
                Contact email
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={profileForm.contactEmail}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-invalid={Boolean(profileErrors.contactEmail)}
              />
              {profileErrors.contactEmail ? (
                <p className="mt-1 text-sm text-rose-600" role="alert">
                  {profileErrors.contactEmail}
                </p>
              ) : null}
            </div>
          </form>
        );
      case "bank":
        return (
          <form className="grid gap-4" aria-labelledby="onboarding-bank">
            <p className="text-sm text-slate-600">
              Enter your bank details. We only retain masked values for your security.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="bsb">
                BSB
              </label>
              <input
                id="bsb"
                name="bsb"
                inputMode="numeric"
                value={bankForm.bsb}
                onChange={(event) => setBankForm((prev) => ({ ...prev, bsb: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-invalid={Boolean(bankErrors.bsb)}
              />
              {bankErrors.bsb ? (
                <p className="mt-1 text-sm text-rose-600" role="alert">
                  {bankErrors.bsb}
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="acc">
                Account number
              </label>
              <input
                id="acc"
                name="acc"
                inputMode="numeric"
                value={bankForm.acc}
                onChange={(event) => setBankForm((prev) => ({ ...prev, acc: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-invalid={Boolean(bankErrors.acc)}
              />
              {bankErrors.acc ? (
                <p className="mt-1 text-sm text-rose-600" role="alert">
                  {bankErrors.acc}
                </p>
              ) : null}
            </div>
            {onboardingState?.bank ? (
              <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700">
                <p className="font-medium">Stored securely</p>
                <p>BSB: {onboardingState.bank.bsbMasked}</p>
                <p>Account: {onboardingState.bank.accMasked}</p>
              </div>
            ) : null}
          </form>
        );
      case "policy":
        return (
          <fieldset className="grid gap-4" aria-labelledby="onboarding-policy">
            <legend className="sr-only">Select a policy</legend>
            {policiesData?.map((policy) => (
              <label
                key={policy.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-200"
              >
                <input
                  type="radio"
                  name="policy"
                  value={policy.id}
                  checked={policySelection === policy.id}
                  onChange={() => setPolicySelection(policy.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-base font-semibold text-slate-800">{policy.name}</span>
                  <span className="text-sm text-slate-600">{policy.description}</span>
                </span>
              </label>
            ))}
            {policyErrors.policyId ? (
              <p className="text-sm text-rose-600" role="alert">
                {policyErrors.policyId}
              </p>
            ) : null}
          </fieldset>
        );
      case "confirm": {
        const summary = queryClient.getQueryData<OnboardingState>(["onboarding", "state"]);
        return (
          <section className="space-y-6" aria-labelledby="onboarding-confirm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Organisation</h3>
              <p className="text-sm text-slate-600">{summary?.profile?.legalName}</p>
              <p className="text-sm text-slate-600">{summary?.profile?.contactEmail}</p>
              {summary?.profile?.abn ? (
                <p className="text-sm text-slate-600">ABN: {summary.profile.abn}</p>
              ) : null}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Bank</h3>
              <p className="text-sm text-slate-600">BSB: {summary?.bank?.bsbMasked}</p>
              <p className="text-sm text-slate-600">Account: {summary?.bank?.accMasked}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Policy</h3>
              <p className="text-sm text-slate-600">
                {policiesData?.find((policy) => policy.id === summary?.policyId)?.name ?? "Not selected"}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4 text-emerald-700">
              You are all set! Review the details and finish onboarding when ready.
            </div>
          </section>
        );
      }
      default:
        return null;
    }
  }, [currentStep, profileForm, profileErrors, bankForm, bankErrors, onboardingState, policiesData, policySelection, policyErrors, queryClient]);

  const isNextDisabled = useMemo(() => {
    const current = steps[currentStep]?.id;
    if (current === "profile") {
      const parsed = profileSchema.safeParse(profileForm);
      return !parsed.success || profileMutation.isPending;
    }
    if (current === "bank") {
      const parsed = bankSchema.safeParse(bankForm);
      return !parsed.success || bankMutation.isPending;
    }
    if (current === "policy") {
      const parsed = policySchema.safeParse({ policyId: policySelection });
      return !parsed.success || policyMutation.isPending;
    }
    return false;
  }, [bankForm, bankMutation.isPending, currentStep, policySelection, policyMutation.isPending, profileForm, profileMutation.isPending]);

  const nextButtonLabel = useMemo(() => {
    if (steps[currentStep]?.id === "confirm") {
      return "Finish";
    }
    return "Next";
  }, [currentStep]);

  const handleNext = async () => {
    const current = steps[currentStep]?.id;
    if (current === "profile") {
      await handleProfileNext();
    } else if (current === "bank") {
      await handleBankNext();
    } else if (current === "policy") {
      await handlePolicyNext();
    } else if (current === "confirm") {
      navigate({ to: "/onboarding" });
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-6 md:p-10" aria-label="Onboarding wizard">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900">Onboarding Wizard</h1>
        <p className="text-slate-600">
          Complete the guided steps to finish setting up your organisation. You can navigate using your keyboard or the controls below.
        </p>
      </header>

      <nav aria-label="Onboarding steps">
        <ol className="flex flex-wrap gap-4" role="list">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < furthestStep;
            const isLocked = index > furthestStep;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    isActive
                      ? "bg-sky-600 text-white focus-visible:outline-sky-600"
                      : isLocked
                      ? "bg-slate-200 text-slate-500 focus-visible:outline-slate-300"
                      : "bg-white text-slate-700 shadow focus-visible:outline-sky-600"
                  }`}
                  disabled={isLocked}
                  onClick={() => setCurrentStep(index)}
                  onKeyDown={(event) => handleStepKeyDown(event, index)}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
                    {isCompleted ? "✓" : index + 1}
                  </span>
                  <span>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="grid gap-8 rounded-2xl bg-white p-6 shadow-lg" aria-live="polite">
        <div className="space-y-1">
          <h2 id={`onboarding-${steps[currentStep]?.id}`} className="text-2xl font-semibold text-slate-900">
            {steps[currentStep]?.label}
          </h2>
          <p className="text-slate-600">{steps[currentStep]?.description}</p>
        </div>
        {stepContent}
        <div className="mt-4 flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={isNextDisabled}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {nextButtonLabel}
          </button>
        </div>
      </section>
    </main>
  );
}
