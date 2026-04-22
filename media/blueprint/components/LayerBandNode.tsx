import type { NodeProps } from "@xyflow/react";
import type { JSX } from "react";

export interface LayerBandData extends Record<string, unknown> {
  layer: number;
  label: string;
  accent: string;
  direction: "RIGHT" | "DOWN";
}

export function LayerBandNode({ data }: NodeProps): JSX.Element {
  const d = data as LayerBandData;
  const gradientDir = d.direction === "DOWN" ? "90deg" : "180deg";
  return (
    <div
      className="layer-band"
      style={{
        borderColor: d.accent,
        background: `linear-gradient(${gradientDir}, ${withAlpha(d.accent, 0.16)} 0%, ${withAlpha(d.accent, 0.04)} 100%)`,
      }}
    >
      <div className="lb-header" style={{ color: d.accent }}>
        <span className="lb-tag">L{d.layer}</span>
        <span className="lb-label">{d.label}</span>
      </div>
    </div>
  );
}

function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/,\s*[\d.]+\)$/, `,${alpha})`);
}
