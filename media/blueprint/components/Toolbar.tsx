import { useEffect, useState, type JSX } from "react";

export interface ToolbarFilters {
  query: string;
  showPlugins: boolean;
  showEnv: boolean;
  showPerms: boolean;
  layout: "LR" | "TB";
}

export interface ToolbarProps {
  filters: ToolbarFilters;
  stats: string;
  onChange: (next: Partial<ToolbarFilters>) => void;
  onFit: () => void;
}

export function Toolbar({ filters, stats, onChange, onFit }: ToolbarProps): JSX.Element {
  const [local, setLocal] = useState(filters.query);

  useEffect(() => {
    const h = setTimeout(() => {
      if (local !== filters.query) onChange({ query: local });
    }, 120);
    return () => clearTimeout(h);
  }, [local, filters.query, onChange]);

  return (
    <header className="toolbar">
      <strong className="brand">🌳 Yggdrasil Blueprint</strong>
      <input
        className="search"
        type="search"
        placeholder="Filter by name…"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        autoComplete="off"
      />
      <label className="toggle">
        <input
          type="checkbox"
          checked={filters.showPlugins}
          onChange={(e) => onChange({ showPlugins: e.target.checked })}
        />
        plugin skills
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={filters.showEnv}
          onChange={(e) => onChange({ showEnv: e.target.checked })}
        />
        env
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={filters.showPerms}
          onChange={(e) => onChange({ showPerms: e.target.checked })}
        />
        permissions
      </label>
      <label className="toggle">
        layout
        <select
          value={filters.layout}
          onChange={(e) => onChange({ layout: e.target.value as "LR" | "TB" })}
        >
          <option value="LR">left → right</option>
          <option value="TB">top → bottom</option>
        </select>
      </label>
      <span className="stats">{stats}</span>
      <button type="button" onClick={onFit}>
        Fit
      </button>
    </header>
  );
}
