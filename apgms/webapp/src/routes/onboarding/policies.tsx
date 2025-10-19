import { useRouter } from "@tanstack/react-router";
import React from "react";
import { clsx } from "clsx";
import { useOnboarding } from "../../onboarding/OnboardingProvider";
import { getStepPath } from "../../onboarding/types";

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  allocations: {
    operating: number;
    tax: number;
    paygw: number;
    gst: number;
  };
}

const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: "balanced",
    name: "Balanced operating",
    description:
      "Ideal for stable businesses allocating a majority to operations while staying on top of compliance obligations.",
    allocations: { operating: 55, tax: 25, paygw: 10, gst: 10 },
  },
  {
    id: "growth",
    name: "Growth accelerator",
    description:
      "Optimise for reinvestment with leaner tax reserves and a stronger operating ratio for rapid expansion.",
    allocations: { operating: 65, tax: 20, paygw: 5, gst: 10 },
  },
  {
    id: "compliance",
    name: "Compliance ready",
    description:
      "Great for new entities building reserves—maximise tax and GST allocations to avoid end-of-quarter surprises.",
    allocations: { operating: 45, tax: 30, paygw: 10, gst: 15 },
  },
];

export function OnboardingPoliciesStep() {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const { data, updateSection } = useOnboarding();
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string | null>(
    data.policies?.templateId ?? null
  );

  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);

  React.useEffect(() => {
    setSelectedId(data.policies?.templateId ?? null);
  }, [data.policies?.templateId]);

  const selectTemplate = React.useCallback(
    (template: PolicyTemplate) => {
      setSelectedId(template.id);
      updateSection("policies", {
        templateId: template.id,
        allocations: template.allocations,
      });
    },
    [updateSection]
  );

  const handleNext = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!selectedId) {
        return;
      }
      await router.navigate({ to: getStepPath("integrations") });
    },
    [router, selectedId]
  );

  const handleBack = React.useCallback(() => {
    router.navigate({ to: getStepPath("bank") }).catch(() => undefined);
  }, [router]);

  const selectedTemplate = selectedId
    ? POLICY_TEMPLATES.find((template) => template.id === selectedId) ?? null
    : null;

  return (
    <form className="space-y-6" onSubmit={handleNext}>
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 focus:outline-none"
        >
          Choose default policies
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Select how APGMS should allocate inbound funds across your operating
          and compliance obligations.
        </p>
      </div>
      <fieldset className="grid gap-4 lg:grid-cols-3" aria-label="Policy template">
        {POLICY_TEMPLATES.map((template) => {
          const checked = selectedId === template.id;
          return (
            <label
              key={template.id}
              className={clsx(
                "flex cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow focus-within:outline focus-within:outline-2 focus-within:outline-blue-500",
                checked && "border-blue-500 ring-2 ring-blue-200"
              )}
            >
              <span className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-900">
                  {template.name}
                </span>
                <input
                  type="radio"
                  name="policy-template"
                  className="h-4 w-4 text-blue-600 focus:outline-none"
                  checked={checked}
                  onChange={() => selectTemplate(template)}
                  aria-describedby={`policy-${template.id}-description`}
                />
              </span>
              <span
                id={`policy-${template.id}-description`}
                className="mt-2 text-sm text-slate-600"
              >
                {template.description}
              </span>
              <table className="mt-4 w-full text-left text-xs text-slate-500">
                <tbody>
                  <tr>
                    <th className="py-1 font-medium text-slate-600">Operating</th>
                    <td className="py-1 text-right text-slate-900">
                      {template.allocations.operating}%
                    </td>
                  </tr>
                  <tr>
                    <th className="py-1 font-medium text-slate-600">Tax</th>
                    <td className="py-1 text-right text-slate-900">
                      {template.allocations.tax}%
                    </td>
                  </tr>
                  <tr>
                    <th className="py-1 font-medium text-slate-600">PAYGW</th>
                    <td className="py-1 text-right text-slate-900">
                      {template.allocations.paygw}%
                    </td>
                  </tr>
                  <tr>
                    <th className="py-1 font-medium text-slate-600">GST</th>
                    <td className="py-1 text-right text-slate-900">
                      {template.allocations.gst}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </label>
          );
        })}
      </fieldset>
      {selectedTemplate ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">Template preview</p>
          <p className="mt-1">
            We'll automatically allocate {selectedTemplate.allocations.operating}%
            of funds to your operating account, with the remainder distributed to
            tax ({selectedTemplate.allocations.tax}%), PAYGW ({selectedTemplate.allocations.paygw}%),
            and GST ({selectedTemplate.allocations.gst}%).
          </p>
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
          disabled={!selectedId}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Continue to integrations
        </button>
      </div>
    </form>
  );
}
