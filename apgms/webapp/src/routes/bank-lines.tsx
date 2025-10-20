import { useEffect, useMemo, useState } from "react";
import { AllocationPreview, AllocationPreviewV } from "../contracts/schemas";

type BankLineState =
  | { status: "loading" }
  | { status: "ready"; data: readonly AllocationPreview[] }
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

const parseAllocationResponse = (
  payload: unknown,
): readonly AllocationPreview[] | null => {
  const items = Array.isArray(payload) ? payload : [payload];
  const parsed: AllocationPreview[] = [];

  for (const entry of items) {
    const result = AllocationPreviewV.safeParse(entry);
    if (!result.success) {
      return null;
    }

    parsed.push(result.data);
  }

  return parsed;
};

const formatCurrency = (value: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch (error) {
    if (isDev) {
      console.warn("[bank-lines] Unable to format currency", error);
    }
    return `${currency} ${value.toFixed(2)}`;
  }
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const BankLinesRoute = (): JSX.Element => {
  const [state, setState] = useState<BankLineState>({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;

    const fetchLines = async () => {
      try {
        const response = await fetch("/api/bank-lines");
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const payload = await response.json();
        const parsed = parseAllocationResponse(payload);

        if (!parsed) {
          throw new Error("Invalid allocation preview payload");
        }

        if (!isCancelled) {
          setState({ status: "ready", data: parsed });
        }
      } catch (error) {
        if (!isCancelled) {
          if (isDev) {
            console.error("[bank-lines] Unable to render bank line preview", error);
          }
          setState({ status: "error", message: "Can't display this item" });
        }
      }
    };

    void fetchLines();

    return () => {
      isCancelled = true;
    };
  }, []);

  const body = useMemo(() => {
    if (state.status === "loading") {
      return <p>Loading bank lines…</p>;
    }

    if (state.status === "error") {
      return (
        <p role="alert" aria-live="assertive">
          {state.message}
        </p>
      );
    }

    if (state.data.length === 0) {
      return <p>No bank lines available.</p>;
    }

    return (
      <ul aria-label="Bank lines overview" className="bank-lines__list">
        {state.data.map((line) => (
          <li key={line.id} className="bank-lines__item">
            <article>
              <header>
                <h2>{line.label}</h2>
              </header>
              <dl>
                <div>
                  <dt>Limit</dt>
                  <dd>{formatCurrency(line.limit, line.currency)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(line.updatedAt)}</dd>
                </div>
              </dl>
            </article>
          </li>
        ))}
      </ul>
    );
  }, [state]);

  return (
    <section aria-labelledby="bank-lines-heading" className="bank-lines">
      <h1 id="bank-lines-heading">Bank lines</h1>
      {body}
    </section>
  );
};

export default BankLinesRoute;
