import { FormEvent, useMemo, useState, type CSSProperties } from "react";
import { api } from "../lib/api";

type Step = {
  id: "profile" | "bank" | "policy" | "confirm";
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    id: "profile",
    title: "Organisation profile",
    description: "Tell us about your organisation.",
  },
  {
    id: "bank",
    title: "Connect bank",
    description: "Provide settlement account details.",
  },
  {
    id: "policy",
    title: "Select policy",
    description: "Choose your risk policy preference.",
  },
  {
    id: "confirm",
    title: "Confirm & submit",
    description: "Review and confirm your information.",
  },
];

type ProfileForm = {
  legalName: string;
  abn: string;
  contactEmail: string;
};

type BankForm = {
  bsb: string;
  accountNumber: string;
};

type PolicyForm = {
  policyId: string;
};

export default function OnboardingRoute() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [profile, setProfile] = useState<ProfileForm>({ legalName: "", abn: "", contactEmail: "" });
  const [bank, setBank] = useState<BankForm>({ bsb: "", accountNumber: "" });
  const [maskedBank, setMaskedBank] = useState<{ bsb: string; accountNumber: string } | null>(null);
  const [policy, setPolicy] = useState<PolicyForm>({ policyId: "standard" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);

  const currentStep = STEPS[currentStepIndex];

  const progress = useMemo(() => {
    return ((currentStepIndex + 1) / STEPS.length) * 100;
  }, [currentStepIndex]);

  const goToStep = (index: number) => {
    setCurrentStepIndex(Math.min(Math.max(index, 0), STEPS.length - 1));
    setError(null);
  };

  const maskValue = (value: string, visible: number) => {
    const clean = value.replace(/\s+/g, "");
    if (!clean) {
      return "";
    }
    const visiblePart = clean.slice(-visible);
    const masked = "•".repeat(Math.max(clean.length - visible, 0)) + visiblePart;
    return masked.replace(/(.{4})/g, "$1 ").trim();
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCompleteMessage(null);
    try {
      await api.onboarding.updateProfile(profile);
      goToStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile");
    } finally {
      setLoading(false);
    }
  };

  const handleBankSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCompleteMessage(null);
    try {
      await api.onboarding.connectBank(bank);
      setMaskedBank({
        bsb: maskValue(bank.bsb, 3),
        accountNumber: maskValue(bank.accountNumber, 4),
      });
      goToStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect bank");
    } finally {
      setLoading(false);
    }
  };

  const handlePolicySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCompleteMessage(null);
    try {
      await api.onboarding.selectPolicy(policy);
      goToStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save policy");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setCompleteMessage("You're all set. Our team will be in touch shortly.");
  };

  const showBack = currentStepIndex > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <header>
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Welcome to APGMS</h2>
        <p style={{ margin: "0.5rem 0 0", color: "#475569", maxWidth: "42rem" }}>
          Complete the onboarding wizard to configure your organisation, connect settlement accounts and
          confirm your compliance posture.
        </p>
      </header>
      <nav aria-label="Progress">
        <ol style={{ display: "flex", gap: "1rem", padding: 0, margin: 0, listStyle: "none" }}>
          {STEPS.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isComplete = index < currentStepIndex;
            return (
              <li key={step.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "9999px",
                    background: isComplete ? "#10b981" : isActive ? "#0ea5e9" : "#cbd5f5",
                    color: isActive || isComplete ? "#ffffff" : "#1e293b",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </span>
                <span aria-current={isActive ? "step" : undefined} style={{ fontWeight: isActive ? 700 : 500 }}>
                  {step.title}
                </span>
              </li>
            );
          })}
        </ol>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Onboarding progress"
          style={{
            marginTop: "1rem",
            height: "0.5rem",
            background: "#e2e8f0",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              background: "#0ea5e9",
              height: "100%",
            }}
          />
        </div>
      </nav>
      {error ? (
        <div role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
          {error}
        </div>
      ) : null}
      {completeMessage ? (
        <div role="status" style={{ color: "#16a34a", fontWeight: 600 }}>
          {completeMessage}
        </div>
      ) : null}
      <section aria-live="polite" aria-busy={loading}>
        {currentStep.id === "profile" && (
          <form onSubmit={handleProfileSubmit} style={formStyle}>
            <fieldset disabled={loading} style={fieldsetStyle}>
              <legend style={legendStyle}>{currentStep.title}</legend>
              <p style={{ color: "#475569" }}>{currentStep.description}</p>
              <label style={labelStyle}>
                Legal name
                <input
                  type="text"
                  name="legalName"
                  value={profile.legalName}
                  onChange={(event) => setProfile((prev) => ({ ...prev, legalName: event.target.value }))}
                  required
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                ABN
                <input
                  type="text"
                  name="abn"
                  value={profile.abn}
                  onChange={(event) => setProfile((prev) => ({ ...prev, abn: event.target.value }))}
                  required
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Contact email
                <input
                  type="email"
                  name="contactEmail"
                  value={profile.contactEmail}
                  onChange={(event) => setProfile((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  required
                  style={inputStyle}
                />
              </label>
              <div style={formActionsStyle}>
                <button type="submit" style={primaryButtonStyle}>
                  Save and continue
                </button>
              </div>
            </fieldset>
          </form>
        )}
        {currentStep.id === "bank" && (
          <form onSubmit={handleBankSubmit} style={formStyle}>
            <fieldset disabled={loading} style={fieldsetStyle}>
              <legend style={legendStyle}>{currentStep.title}</legend>
              <p style={{ color: "#475569" }}>{currentStep.description}</p>
              <label style={labelStyle}>
                BSB
                <input
                  type="text"
                  name="bsb"
                  inputMode="numeric"
                  value={bank.bsb}
                  onChange={(event) => setBank((prev) => ({ ...prev, bsb: event.target.value }))}
                  required
                  style={inputStyle}
                  placeholder="000-000"
                />
              </label>
              <label style={labelStyle}>
                Account number
                <input
                  type="text"
                  name="accountNumber"
                  inputMode="numeric"
                  value={bank.accountNumber}
                  onChange={(event) => setBank((prev) => ({ ...prev, accountNumber: event.target.value }))}
                  required
                  style={inputStyle}
                  placeholder="000000000"
                />
              </label>
              <div style={formActionsStyle}>
                {showBack && (
                  <button type="button" onClick={() => goToStep(currentStepIndex - 1)} style={secondaryButtonStyle}>
                    Back
                  </button>
                )}
                <button type="submit" style={primaryButtonStyle}>
                  Connect account
                </button>
              </div>
            </fieldset>
          </form>
        )}
        {currentStep.id === "policy" && (
          <form onSubmit={handlePolicySubmit} style={formStyle}>
            <fieldset disabled={loading} style={fieldsetStyle}>
              <legend style={legendStyle}>{currentStep.title}</legend>
              <p style={{ color: "#475569" }}>{currentStep.description}</p>
              <div role="radiogroup" aria-label="Policy options" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="policyId"
                    value="standard"
                    checked={policy.policyId === "standard"}
                    onChange={(event) => setPolicy({ policyId: event.target.value })}
                  />
                  <span>
                    <strong>Standard</strong>
                    <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>
                      Balanced controls for teams new to APGMS.
                    </p>
                  </span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="policyId"
                    value="conservative"
                    checked={policy.policyId === "conservative"}
                    onChange={(event) => setPolicy({ policyId: event.target.value })}
                  />
                  <span>
                    <strong>Conservative</strong>
                    <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>
                      Highest review thresholds for emerging organisations.
                    </p>
                  </span>
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="policyId"
                    value="custom"
                    checked={policy.policyId === "custom"}
                    onChange={(event) => setPolicy({ policyId: event.target.value })}
                  />
                  <span>
                    <strong>Custom</strong>
                    <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>
                      We'll reach out to tailor a bespoke policy with you.
                    </p>
                  </span>
                </label>
              </div>
              <div style={formActionsStyle}>
                {showBack && (
                  <button type="button" onClick={() => goToStep(currentStepIndex - 1)} style={secondaryButtonStyle}>
                    Back
                  </button>
                )}
                <button type="submit" style={primaryButtonStyle}>
                  Continue
                </button>
              </div>
            </fieldset>
          </form>
        )}
        {currentStep.id === "confirm" && (
          <div style={{ ...formStyle, gap: "1.5rem" }}>
            <header>
              <h3 style={{ margin: 0 }}>{currentStep.title}</h3>
              <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>{currentStep.description}</p>
            </header>
            <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.5rem 1rem" }}>
              <dt style={summaryTitleStyle}>Legal name</dt>
              <dd style={summaryValueStyle}>{profile.legalName}</dd>
              <dt style={summaryTitleStyle}>ABN</dt>
              <dd style={summaryValueStyle}>{profile.abn}</dd>
              <dt style={summaryTitleStyle}>Contact email</dt>
              <dd style={summaryValueStyle}>{profile.contactEmail}</dd>
              <dt style={summaryTitleStyle}>BSB</dt>
              <dd style={summaryValueStyle}>{maskedBank?.bsb ?? "—"}</dd>
              <dt style={summaryTitleStyle}>Account</dt>
              <dd style={summaryValueStyle}>{maskedBank?.accountNumber ?? "—"}</dd>
              <dt style={summaryTitleStyle}>Policy</dt>
              <dd style={summaryValueStyle}>{policyLabel(policy.policyId)}</dd>
            </dl>
            <div style={formActionsStyle}>
              {showBack && (
                <button type="button" onClick={() => goToStep(currentStepIndex - 1)} style={secondaryButtonStyle}>
                  Back
                </button>
              )}
              <button type="button" onClick={handleFinish} style={primaryButtonStyle}>
                Confirm
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function policyLabel(id: string) {
  switch (id) {
    case "conservative":
      return "Conservative";
    case "custom":
      return "Custom";
    default:
      return "Standard";
  }
}

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const fieldsetStyle: CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.4)",
  borderRadius: "0.75rem",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const legendStyle: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  borderRadius: "0.5rem",
  border: "1px solid rgba(148, 163, 184, 0.6)",
  padding: "0.75rem",
  fontSize: "1rem",
};

const formActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  marginTop: "1rem",
};

const primaryButtonStyle: CSSProperties = {
  background: "#0ea5e9",
  border: "1px solid #0ea5e9",
  borderRadius: "0.75rem",
  padding: "0.75rem 1.5rem",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(148, 163, 184, 0.6)",
  borderRadius: "0.75rem",
  padding: "0.75rem 1.5rem",
  color: "#1e293b",
  fontWeight: 600,
  cursor: "pointer",
};

const radioLabelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "flex-start",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(148, 163, 184, 0.6)",
};

const summaryTitleStyle: CSSProperties = {
  fontWeight: 600,
  color: "#475569",
};

const summaryValueStyle: CSSProperties = {
  margin: 0,
  fontWeight: 600,
};
