import type { LineFilters } from "../types";

interface Props {
  filters: LineFilters;
  onChange: (filters: LineFilters) => void;
}

export default function FiltersPanel({ filters, onChange }: Props) {
  function update<K extends keyof LineFilters>(key: K, value: LineFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section>
      <h2>Filter bank lines</h2>
      <div className="filters-grid" role="search">
        <label>
          Organisation ID
          <input
            value={filters.orgId}
            placeholder="org_123"
            onChange={(event) => update("orgId", event.target.value)}
          />
        </label>
        <label>
          From date
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => update("from", event.target.value)}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => update("to", event.target.value)}
          />
        </label>
        <label>
          Payee
          <input
            value={filters.payee ?? ""}
            placeholder="Search by payee"
            onChange={(event) => update("payee", event.target.value)}
          />
        </label>
        <label>
          Cleared
          <select
            value={filters.cleared ?? ""}
            onChange={(event) => update("cleared", event.target.value as LineFilters["cleared"])}
          >
            <option value="">All</option>
            <option value="true">Cleared</option>
            <option value="false">Uncleared</option>
          </select>
        </label>
      </div>
    </section>
  );
}
