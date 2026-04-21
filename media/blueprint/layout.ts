import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";

const elk = new ELK();

const NODE_W: Record<string, number> = {
  workspace: 220,
  pluginGroup: 200,
  plugin: 180,
  mcp: 200,
  claudeMd: 180,
  skill: 200,
  hook: 220,
  memory: 200,
  rule: 180,
  permission: 220,
  configFile: 180,
  tool: 130,
  env: 140,
};

const NODE_H: Record<string, number> = {
  workspace: 100,
  pluginGroup: 90,
  plugin: 80,
  mcp: 80,
  claudeMd: 70,
  skill: 90,
  hook: 90,
  memory: 80,
  rule: 70,
  permission: 80,
  configFile: 70,
  tool: 50,
  env: 50,
};

export type LayoutDirection = "RIGHT" | "DOWN";

export async function layoutNodes<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: LayoutDirection = "RIGHT",
): Promise<Node<T>[]> {
  if (nodes.length === 0) return nodes;

  const elkNodes = nodes.map((n) => {
    const kind = ((n.data as { kind?: string })?.kind ?? "skill") as string;
    return {
      id: n.id,
      width: NODE_W[kind] ?? 180,
      height: NODE_H[kind] ?? 80,
    };
  });
  const elkEdges = edges.map((e) => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
  }));

  try {
    const result = await elk.layout({
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": direction,
        "elk.aspectRatio": "1.78",
        "elk.layered.spacing.nodeNodeBetweenLayers": "90",
        "elk.spacing.nodeNode": "40",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.edgeRouting": "POLYLINE",
        "elk.layered.compaction.connectedComponents": "true",
        "elk.layered.thoroughness": "30",
        "elk.padding": "[top=40,left=40,bottom=40,right=40]",
      },
      children: elkNodes,
      edges: elkEdges,
    });

    const positions = new Map<string, { x: number; y: number }>();
    for (const child of result.children ?? []) {
      if (typeof child.x === "number" && typeof child.y === "number") {
        positions.set(child.id, { x: child.x, y: child.y });
      }
    }
    return nodes.map((n) => {
      const p = positions.get(n.id);
      return p ? { ...n, position: p } : n;
    });
  } catch {
    return fallbackGrid(nodes);
  }
}

export function fallbackGrid<T extends Record<string, unknown>>(nodes: Node<T>[]): Node<T>[] {
  const COLS = Math.max(1, Math.ceil(Math.sqrt(nodes.length * 1.78)));
  const COL_W = 240;
  const ROW_H = 120;
  return nodes.map((n, i) => ({
    ...n,
    position: { x: (i % COLS) * COL_W, y: Math.floor(i / COLS) * ROW_H },
  }));
}
