import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listBankLines,
  listCategories,
  updateBankLine,
  type UpdateBankLineInput,
} from "./api/client";
import CsvUploader from "./components/CsvUploader";
import FiltersPanel from "./components/FiltersPanel";
import LineRow from "./components/LineRow";
import type { BankLine, Category, LineFilters } from "./types";

const PAGE_SIZE = 25;

export default function App() {
  const [filters, setFilters] = useState<LineFilters>({
    orgId: import.meta.env.VITE_ORG_ID ?? "",
    cleared: "",
    payee: "",
    from: "",
    to: "",
  });
  const [lines, setLines] = useState<BankLine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        orgId: filters.orgId,
        from: filters.from,
        to: filters.to,
        payee: filters.payee,
        cleared: filters.cleared,
      }),
    [filters],
  );

  const refreshCategories = useCallback(async (orgId: string) => {
    if (!orgId) {
      setCategories([]);
      return;
    }
    const fetched = await listCategories(orgId);
    setCategories(fetched);
  }, []);

  const loadPage = useCallback(
    async (reset = false) => {
      if (!filters.orgId) {
        setLines([]);
        setHasMore(false);
        return;
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const response = await listBankLines({
          ...filters,
          cursor: reset ? null : cursorRef.current,
          take: PAGE_SIZE,
        });

        cursorRef.current = response.nextCursor ?? null;
        setHasMore(Boolean(response.nextCursor));
        setLines((prev) => (reset ? response.lines : [...prev, ...response.lines]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load bank lines");
        setHasMore(false);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    cursorRef.current = null;
    setLines([]);
    setHasMore(true);
    void loadPage(true);
  }, [filtersKey, loadPage]);

  useEffect(() => {
    void refreshCategories(filters.orgId);
  }, [filters.orgId, refreshCategories]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadPage();
      }
    });

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadPage]);

  const handleLineUpdate = useCallback(
    async (lineId: string, body: UpdateBankLineInput) => {
      if (!filters.orgId) throw new Error("Organisation ID is required");
      let previousLine: BankLine | null = null;
      setLines((prev) => {
        previousLine = prev.find((line) => line.id === lineId) ?? null;
        return prev.map((line) => (line.id === lineId ? { ...line, ...body } : line));
      });

      try {
        const updated = await updateBankLine(lineId, filters.orgId, body);
        setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...updated } : line)));
      } catch (err) {
        if (previousLine) {
          setLines((prev) =>
            prev.map((line) => (line.id === lineId ? { ...previousLine! } : line)),
          );
        }
        throw err;
      }
    },
    [filters.orgId],
  );

  return (
    <main>
      <header>
        <h1>APGMS Bank Lines</h1>
        <span className="badge">Org: {filters.orgId || "(not set)"}</span>
      </header>

      <FiltersPanel filters={filters} onChange={setFilters} />
      <CsvUploader orgId={filters.orgId} onImported={() => void loadPage(true)} />

      <section>
        <h2>Lines</h2>
        {error && <p className="status-message error">{error}</p>}
        {!filters.orgId && (
          <p className="status-message error">Enter an organisation ID to load bank lines.</p>
        )}
        <table className="table" aria-live="polite">
          <thead>
            <tr>
              <th>Payee</th>
              <th>Amount</th>
              <th>Category</th>
              <th>Cleared</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                categories={categories}
                onUpdate={handleLineUpdate}
              />
            ))}
            {loading && (
              <tr>
                <td colSpan={5} className="status-message">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div ref={sentinelRef} style={{ height: 1 }} />
        {!loading && !hasMore && lines.length > 0 && (
          <p className="status-message success">You have reached the end of the list.</p>
        )}
        {!loading && lines.length === 0 && filters.orgId && (
          <p className="status-message">No lines found for the current filters.</p>
        )}
      </section>

      <footer>
        Built with Vite + React. All requests include the required API headers.
      </footer>
    </main>
  );
}
