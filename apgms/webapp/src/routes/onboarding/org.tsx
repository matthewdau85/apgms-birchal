import { useRouter } from "@tanstack/react-router";
import React from "react";
import { useOnboarding } from "../../onboarding/OnboardingProvider";
import { getStepPath } from "../../onboarding/types";

interface OrgFormState {
  name: string;
  abn: string;
  address: string;
}

const EMPTY_FORM: OrgFormState = {
  name: "",
  abn: "",
  address: "",
};

const ABN_REGEX = /^[0-9]{11}$/;

export function OnboardingOrgStep() {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const { data, updateSection } = useOnboarding();
  const router = useRouter();
  const [form, setForm] = React.useState<OrgFormState>({
    ...EMPTY_FORM,
    ...data.org,
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof OrgFormState, string>>>({});

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  React.useEffect(() => {
    setForm({
      ...EMPTY_FORM,
      ...data.org,
    });
  }, [data.org?.name, data.org?.abn, data.org?.address]);

  const updateField = React.useCallback(
    <K extends keyof OrgFormState>(field: K, value: OrgFormState[K]) => {
      setForm((previous) => {
        const next = { ...previous, [field]: value };
        updateSection("org", next);
        return next;
      });
    },
    [updateSection]
  );

  const validate = React.useCallback(() => {
    const nextErrors: Partial<Record<keyof OrgFormState, string>> = {};
    if (!form.name.trim()) {
      nextErrors.name = "Organisation name is required";
    }
    if (!ABN_REGEX.test(form.abn.trim())) {
      nextErrors.abn = "ABN must be exactly 11 digits";
    }
    if (!form.address.trim()) {
      nextErrors.address = "Business address is required";
    }
    setErrors(nextErrors);
    return nextErrors;
  }, [form.address, form.abn, form.name]);

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const validationErrors = validate();
      if (Object.keys(validationErrors).length > 0) {
        const firstErrorField = Object.keys(validationErrors)[0] as keyof OrgFormState | undefined;
        if (firstErrorField) {
          document.getElementById(`org-${firstErrorField}`)?.focus();
        }
        return;
      }
      await router.navigate({ to: getStepPath("bank") });
    },
    [router, validate]
  );

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 focus:outline-none"
        >
          Organisation details
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Your organisation details help us match your account with the correct
          registers and compliance obligations.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="org-name">
            Organisation name
          </label>
          <input
            id="org-name"
            name="name"
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-invalid={errors.name ? "true" : "false"}
            aria-describedby={errors.name ? "org-name-error" : undefined}
          />
          {errors.name ? (
            <p id="org-name-error" className="mt-1 text-sm text-red-600">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="org-abn">
            Australian Business Number (ABN)
          </label>
          <input
            id="org-abn"
            name="abn"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.abn}
            onChange={(event) => updateField("abn", event.target.value.replace(/\D/g, ""))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-invalid={errors.abn ? "true" : "false"}
            aria-describedby={errors.abn ? "org-abn-error" : undefined}
          />
          {errors.abn ? (
            <p id="org-abn-error" className="mt-1 text-sm text-red-600">
              {errors.abn}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              We'll validate this with the Australian Business Register.
            </p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="org-address">
          Principal place of business
        </label>
        <textarea
          id="org-address"
          name="address"
          rows={3}
          value={form.address}
          onChange={(event) => updateField("address", event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-invalid={errors.address ? "true" : "false"}
          aria-describedby={errors.address ? "org-address-error" : undefined}
        />
        {errors.address ? (
          <p id="org-address-error" className="mt-1 text-sm text-red-600">
            {errors.address}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Continue to bank setup
        </button>
      </div>
    </form>
  );
}
