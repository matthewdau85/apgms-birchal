import { useEffect, useMemo, useState } from "react";
import { Rpt, RptV } from "../contracts/schemas";

type AuditState =
  | { status: "loading" }
  | { status: "ready"; data: Rpt }
  | { status: "error"; message: string };

const getIsDev = (): boolean => {
  if (typeof import.meta !== "undefined" && typeof (import.meta as any).env !== "undefined") {
    const maybeEnv = (import.meta as any).env;
    if (typeof maybeEnv.DEV === "boolean") {
      return maybeEnv.DEV;
    }
  }

  if (typeof process !== "undefined" && process.env && typeof process.env.NODE_ENV === "string") {
    return process.env.NODE_ENV !== "production";
  }

  return false;
};

const isDev = getIsDev();

const sanitizeAdvanced = (
  advanced: Readonly<Record<string, string | number | boolean | null>>,
): ReadonlyArray<[string, string]> =>
  Object.entries(advanced).map(([key, value]) => [key, String(value)] as const);

const AuditRoute = (): JSX.Element => {
  const [state, setState] = useState<AuditState>({ status: "loading" });
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const fetchRpt = async () => {
      try {
        const response = await fetch("/api/audit/rpt");
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const payload = await response.json();
        const result = RptV.safeParse(payload);

        if (!result.success) {
          throw new Error("Invalid RPT payload");
        }

        if (!isCancelled) {
          setState({ status: "ready", data: result.data });
        }
      } catch (error) {
        if (!isCancelled) {
          if (isDev) {
            console.error("[audit] Unable to render RPT", error);
          }
          setState({ status: "error", message: "Verification unavailable" });
        }
      }
    };

    void fetchRpt();

    return () => {
      isCancelled = true;
    };
  }, []);

  const body = useMemo(() => {
    if (state.status === "loading") {
      return <p>Loading verification…</p>;
    }

    if (state.status === "error") {
      return (
        <p role="alert" aria-live="assertive">
          {state.message}
        </p>
      );
    }

    const { data } = state;

    return (
      <article aria-labelledby="audit-rpt-heading">
        <header>
          <h1 id="audit-rpt-heading">Audit verification</h1>
          <p className="audit-rpt__meta">
            <span>Status: {data.status}</span>
            <span>Generated: {new Date(data.generatedAt).toLocaleString()}</span>
          </p>
        </header>
        <section aria-label="Summary">
          <p>{data.summary}</p>
        </section>
        {data.advanced && (
          <section aria-label="Advanced details" className="audit-rpt__advanced">
            <button type="button" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? "Hide advanced details" : "Show advanced details"}
            </button>
            {showAdvanced && (
              <dl>
                {sanitizeAdvanced(data.advanced).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}
      </article>
    );
  }, [showAdvanced, state]);

  return (
    <section className="audit-rpt" aria-live="polite">
      {body}
    </section>
  );
};

export default AuditRoute;
