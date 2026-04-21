import { type NodeProps } from "@xyflow/react";
import type { JSX } from "react";

const KIND_LABEL: Record<string, string> = {
  workspace: "Workspace",
  pluginGroup: "Plugins",
  plugin: "Plugin entries",
  mcp: "MCP servers",
  claudeMd: "CLAUDE.md / AGENTS.md",
  skill: "Skills",
  hook: "Hooks",
  memory: "Memory",
  rule: "Rules",
  permission: "Permissions",
  configFile: "Config files",
  tool: "Tools",
  env: "Env vars",
};

const KIND_ACCENT: Record<string, string> = {
  workspace: "rgba(124, 58, 237, 0.55)",
  pluginGroup: "rgba(45, 212, 191, 0.5)",
  plugin: "rgba(20, 184, 166, 0.5)",
  mcp: "rgba(59, 130, 246, 0.5)",
  claudeMd: "rgba(236, 72, 153, 0.5)",
  skill: "rgba(245, 158, 11, 0.55)",
  hook: "rgba(239, 68, 68, 0.5)",
  memory: "rgba(168, 85, 247, 0.5)",
  rule: "rgba(56, 189, 248, 0.5)",
  permission: "rgba(107, 114, 128, 0.55)",
  configFile: "rgba(250, 204, 21, 0.55)",
  tool: "rgba(34, 211, 238, 0.55)",
  env: "rgba(132, 204, 22, 0.55)",
};

export interface CategoryGroupData extends Record<string, unknown> {
  kind: string;
  count: number;
  layer: number;
  collapsed: boolean;
}

export function CategoryGroupNode({ data }: NodeProps): JSX.Element {
  const d = data as CategoryGroupData;
  const accent = KIND_ACCENT[d.kind] ?? "rgba(148, 163, 184, 0.5)";
  const label = KIND_LABEL[d.kind] ?? d.kind;

  if (d.collapsed) {
    return (
      <div
        className="category-group collapsed"
        style={{
          borderColor: accent,
          background: `linear-gradient(180deg, ${withAlpha(accent, 0.28)} 0%, ${withAlpha(accent, 0.1)} 100%)`,
        }}
        title={`${d.count} ${label.toLowerCase()} — click to expand`}
      >
        <div className="cg-summary" style={{ color: accent }}>
          <span className="cg-caret">▸</span>
          <span className="cg-label">{label}</span>
          <span className="cg-count">{d.count}</span>
        </div>
        <div className="cg-hint">click to expand</div>
      </div>
    );
  }

  return (
    <div
      className="category-group"
      style={{
        borderColor: accent,
        background: `linear-gradient(180deg, ${withAlpha(accent, 0.18)} 0%, ${withAlpha(accent, 0.04)} 100%)`,
      }}
    >
      <div className="cg-header" style={{ color: accent }}>
        <span className="cg-caret">▾</span>
        <span className="cg-label">{label}</span>
        <span className="cg-count">{d.count}</span>
        <span className="cg-layer">layer {d.layer}</span>
      </div>
    </div>
  );
}

function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/,\s*[\d.]+\)$/, `,${alpha})`);
}
