import { useEffect, useMemo, useState } from "react";
import type { Category, BankLine } from "../types";

interface Props {
  line: BankLine;
  categories: Category[];
  onUpdate: (lineId: string, body: Partial<Pick<BankLine, "notes" | "cleared" | "categoryId">>) => Promise<void>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

export default function LineRow({ line, categories, onUpdate }: Props) {
  const [notes, setNotes] = useState(line.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(line.notes ?? "");
  }, [line.notes]);

  const categoryOptions = useMemo(() => {
    const items = categories.slice();
    if (line.categoryId && !categories.find((cat) => cat.id === line.categoryId)) {
      items.push({ id: line.categoryId, name: line.categoryName ?? line.categoryId });
    }
    return items;
  }, [categories, line.categoryId, line.categoryName]);

  async function commit(body: Partial<Pick<BankLine, "notes" | "cleared" | "categoryId">>) {
    try {
      setSaving(true);
      setError(null);
      await onUpdate(line.id, body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save changes");
    } finally {
      setSaving(false);
    }
  }

  const amount = formatCurrency(line.amount);
  const date = formatDate(line.date);

  return (
    <tr>
      <td>
        <div className="line-payee">{line.payee}</div>
        <div className="line-meta">{date}</div>
      </td>
      <td>
        <div>{amount}</div>
        {line.description && <div className="line-meta">{line.description}</div>}
      </td>
      <td>
        <select
          value={line.categoryId ?? ""}
          onChange={(event) =>
            commit({ categoryId: event.target.value ? event.target.value : null })
          }
          disabled={saving}
        >
          <option value="">Unassigned</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={Boolean(line.cleared)}
            onChange={(event) => commit({ cleared: event.target.checked })}
            disabled={saving}
          />
          <span className="badge">{line.cleared ? "Cleared" : "Pending"}</span>
        </label>
      </td>
      <td>
        <textarea
          className="notes-input"
          value={notes}
          placeholder="Add internal notes"
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes !== (line.notes ?? "")) {
              void commit({ notes });
            }
          }}
          disabled={saving}
        />
        {error && <div className="status-message error">{error}</div>}
      </td>
    </tr>
  );
}
