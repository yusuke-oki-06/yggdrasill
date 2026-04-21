import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CSSProperties, JSX } from "react";
import type { NodeData } from "../types.js";

const KIND_META: Record<
  string,
  { color: string; bg: string; border: string; icon: string; chip?: string }
> = {
  workspace: {
    color: "#ddd6fe",
    bg: "linear-gradient(135deg,#5b21b6,#6d28d9)",
    border: "#8b5cf6",
    icon: "🌳",
  },
  pluginGroup: {
    color: "#ccfbf1",
    bg: "linear-gradient(135deg,#0f766e,#14b8a6)",
    border: "#2dd4bf",
    icon: "🧩",
    chip: "plugin",
  },
  plugin: { color: "#ccfbf1", bg: "#134e4a", border: "#14b8a6", icon: "🧩", chip: "plugin" },
  skill: { color: "#fde68a", bg: "#78350f", border: "#f59e0b", icon: "✨", chip: "skill" },
  hook: { color: "#fecaca", bg: "#7f1d1d", border: "#ef4444", icon: "⚡", chip: "hook" },
  mcp: { color: "#bfdbfe", bg: "#1e3a8a", border: "#3b82f6", icon: "🔌", chip: "mcp" },
  memory: { color: "#e9d5ff", bg: "#581c87", border: "#a855f7", icon: "🧠", chip: "memory" },
  permission: {
    color: "#e5e7eb",
    bg: "#374151",
    border: "#6b7280",
    icon: "🔒",
    chip: "permission",
  },
  rule: { color: "#bae6fd", bg: "#0c4a6e", border: "#38bdf8", icon: "📐", chip: "rule" },
  claudeMd: { color: "#fbcfe8", bg: "#831843", border: "#ec4899", icon: "📄", chip: "docs" },
  env: { color: "#d9f99d", bg: "#365314", border: "#84cc16", icon: "🔑", chip: "env" },
  tool: { color: "#a5f3fc", bg: "#164e63", border: "#22d3ee", icon: "🛠️", chip: "tool" },
  configFile: {
    color: "#fef08a",
    bg: "#713f12",
    border: "#facc15",
    icon: "📁",
    chip: "config",
  },
};

export interface HarnessNodeData extends Record<string, unknown> {
  payload: NodeData;
  hasIssue: boolean;
}

export function HarnessNode({ data, selected }: NodeProps): JSX.Element {
  const d = data as HarnessNodeData;
  const node = d.payload;
  const meta = KIND_META[node.kind] ?? KIND_META.skill;
  const isCompact = node.kind === "tool" || node.kind === "env";

  return (
    <div
      className={`harness-node${selected ? " selected" : ""}${d.hasIssue ? " has-issue" : ""}${
        isCompact ? " compact" : ""
      }`}
      style={
        {
          background: meta.bg,
          color: meta.color,
          borderColor: meta.border,
        } satisfies CSSProperties
      }
      title={node.description || node.path || node.label}
    >
      <Handle type="target" position={Position.Left} className="hn-handle" />
      <div className="hn-row">
        <span className="hn-icon" aria-hidden="true">
          {meta.icon}
        </span>
        <span className="hn-label">{node.label}</span>
      </div>
      {!isCompact && (node.description || node.source) ? (
        <div className="hn-meta">
          {meta.chip ? <span className="hn-chip">{meta.chip}</span> : null}
          {node.source ? <span className="hn-chip outline">{node.source}</span> : null}
          {node.description ? (
            <span className="hn-desc">{truncate(node.description, 60)}</span>
          ) : null}
        </div>
      ) : null}
      {d.hasIssue ? <span className="hn-issue-dot" aria-hidden="true" /> : null}
      <Handle type="source" position={Position.Right} className="hn-handle" />
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
