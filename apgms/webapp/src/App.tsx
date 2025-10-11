import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type BankLine = {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  desc: string;
};

const fetchBankLines = async () => {
  const response = await fetch(`${API_URL}/bank-lines`);
  if (!response.ok) {
    throw new Error("Failed to load bank lines");
  }
  const payload = (await response.json()) as { lines: BankLine[] };
  return payload.lines;
};

const createBankLine = async (payload: Omit<BankLine, "id">) => {
  const response = await fetch(`${API_URL}/bank-lines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to create bank line");
  }

  return (await response.json()) as BankLine;
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankLines, setBankLines] = useState<BankLine[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchBankLines()
      .then((lines) => {
        if (cancelled) {
          return;
        }
        setBankLines(lines);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const latestOrgId = useMemo(() => bankLines[0]?.orgId ?? "", [bankLines]);

  const handleCreate = async () => {
    if (!latestOrgId) {
      return;
    }

    setIsCreating(true);
    try {
      const amount = Number((Math.random() * 1000 - 500).toFixed(2));
      const newLine = await createBankLine({
        orgId: latestOrgId,
        date: new Date().toISOString(),
        amount,
        payee: amount >= 0 ? "Invoice" : "Vendor",
        desc: amount >= 0 ? "Incoming payment" : "Outgoing payment",
      });
      setBankLines((prev) => [newLine, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-brand-700">APGMS Demo</p>
            <h1 className="text-3xl font-bold">Banking Activity</h1>
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-md border border-brand-700 bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                void handleCreate();
              }}
              disabled={isCreating || !latestOrgId}
            >
              {isCreating ? "Creating..." : "Add random line"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {isLoading ? (
          <p className="text-slate-400">Loading bank lines…</p>
        ) : error ? (
          <p className="text-rose-400">{error}</p>
        ) : bankLines.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-800 shadow-lg shadow-slate-900/50">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900/60">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-widest text-slate-400">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-widest text-slate-400">Payee</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-widest text-slate-400">Description</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-widest text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 bg-slate-950/50">
                {bankLines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-900/60">
                    <td className="px-6 py-4 text-sm text-slate-200">
                      {new Date(line.date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-100">{line.payee}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{line.desc}</td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-brand-700">
                      {line.amount.toLocaleString(undefined, {
                        style: "currency",
                        currency: "AUD",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400">No bank lines available.</p>
        )}
      </main>
    </div>
  );
}
