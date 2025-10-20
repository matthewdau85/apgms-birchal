import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useSearchParams } from "react-router-dom";

type BankLine = {
  id: string;
  date: string;
  payee: string;
  amount: number;
};

type BankLinesResponse = {
  items: BankLine[];
  nextCursor?: string | null;
  prevCursor?: string | null;
};

type GetBankLinesArgs = {
  orgId: string;
  take: number;
  cursor?: string | null;
};

async function getBankLines({ orgId, take, cursor }: GetBankLinesArgs) {
  const params = new URLSearchParams({ orgId, take: String(take) });
  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(`/api/bank-lines?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to load bank lines.");
  }

  return (await response.json()) as BankLinesResponse;
}

async function getRptByLine(lineId: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { id: lineId, status: "verified" } as const;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

const SKELETON_ROWS = 5;

export default function BankLinesRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orgId = searchParams.get("orgId");

  const parsedTake = Number(searchParams.get("take") ?? "20");
  const take = Number.isFinite(parsedTake) && parsedTake > 0 ? parsedTake : 20;
  const cursor = searchParams.get("cursor") ?? undefined;

  const [data, setData] = React.useState<BankLinesResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [selectedLine, setSelectedLine] = React.useState<BankLine | null>(null);
  const [verifyStatus, setVerifyStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!orgId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getBankLines({ orgId, take, cursor })
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, take, cursor, refreshKey]);

  React.useEffect(() => {
    if (!selectedLine) {
      setVerifyStatus("idle");
    }
  }, [selectedLine]);

  const verifyButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (selectedLine && verifyButtonRef.current) {
      verifyButtonRef.current.focus();
    }
  }, [selectedLine]);

  const handleRetry = () => {
    setRefreshKey((value) => value + 1);
  };

  const updateCursor = (nextCursor: string | null | undefined) => {
    const next = new URLSearchParams(searchParams);
    next.set("take", String(take));
    if (nextCursor) {
      next.set("cursor", nextCursor);
    } else {
      next.delete("cursor");
    }
    setSearchParams(next);
  };

  const handleVerify = async () => {
    if (!selectedLine) {
      return;
    }

    try {
      setVerifyStatus("loading");
      await getRptByLine(selectedLine.id);
      setVerifyStatus("success");
    } catch (err) {
      setVerifyStatus("error");
    }
  };

  if (!orgId) {
    return (
      <div role="alert" style={{ padding: "1rem" }}>
        Missing required <code>orgId</code> query parameter.
      </div>
    );
  }

  const lines = data?.items ?? [];
  const isEmpty = !isLoading && lines.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Bank lines</h1>
      </header>

      {error ? (
        <div role="alert" style={{ border: "1px solid #f5c2c7", background: "#f8d7da", color: "#842029", padding: "0.75rem", borderRadius: "0.5rem" }}>
          <p style={{ margin: 0 }}>Unable to load bank lines. Please try again.</p>
          <button type="button" onClick={handleRetry} style={{ marginTop: "0.5rem" }}>
            Retry
          </button>
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #ddd" }}>Date</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid #ddd" }}>Payee</th>
              <th style={{ textAlign: "right", padding: "0.75rem", borderBottom: "1px solid #ddd" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                  <tr key={index}>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #eee" }}>
                      <div style={{ height: "1rem", background: "#e5e7eb", borderRadius: "0.25rem", width: "70%" }} aria-hidden />
                    </td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #eee" }}>
                      <div style={{ height: "1rem", background: "#e5e7eb", borderRadius: "0.25rem", width: "85%" }} aria-hidden />
                    </td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #eee" }}>
                      <div style={{ height: "1rem", background: "#e5e7eb", borderRadius: "0.25rem", width: "50%", marginLeft: "auto" }} aria-hidden />
                    </td>
                  </tr>
                ))
              : isEmpty
              ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "1.5rem", textAlign: "center" }}>
                      No bank lines yet
                    </td>
                  </tr>
                )
              : lines.map((line) => (
                  <tr
                    key={line.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedLine(line)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedLine(line);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                    aria-label={`View details for ${line.payee} on ${formatDate(line.date)}`}
                  >
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #eee" }}>{formatDate(line.date)}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #eee" }}>{line.payee}</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #eee", textAlign: "right" }}>{formatCurrency(line.amount)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Pagination" style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={() => updateCursor(data?.prevCursor ?? null)}
          disabled={!data?.prevCursor || isLoading}
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => updateCursor(data?.nextCursor ?? null)}
          disabled={!data?.nextCursor || isLoading}
        >
          Next
        </button>
      </nav>

      <Dialog.Root
        open={Boolean(selectedLine)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLine(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          />
          <Dialog.Content
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100%)",
              background: "#fff",
              boxShadow: "-2px 0 12px rgba(15, 23, 42, 0.15)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <VisuallyHidden.Root>
              <Dialog.Title>Bank line details</Dialog.Title>
            </VisuallyHidden.Root>
            <Dialog.Description>
              Review and verify the selected bank line.
            </Dialog.Description>

            {selectedLine ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <span style={{ display: "block", fontSize: "0.875rem", color: "#6b7280" }}>Date</span>
                  <span>{formatDate(selectedLine.date)}</span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.875rem", color: "#6b7280" }}>Payee</span>
                  <span>{selectedLine.payee}</span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.875rem", color: "#6b7280" }}>Amount</span>
                  <span>{formatCurrency(selectedLine.amount)}</span>
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifyStatus === "loading"}
                ref={verifyButtonRef}
              >
                {verifyStatus === "loading" ? "Verifying..." : "Verify RPT"}
              </button>
              {verifyStatus === "success" ? (
                <span role="status" style={{ color: "#047857" }}>
                  RPT verified
                </span>
              ) : null}
              {verifyStatus === "error" ? (
                <span role="alert" style={{ color: "#b91c1c" }}>
                  Verification failed
                </span>
              ) : null}
            </div>

            <Dialog.Close asChild>
              <button type="button" style={{ alignSelf: "flex-start" }}>
                Close
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
