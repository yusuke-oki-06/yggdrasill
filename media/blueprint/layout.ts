import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";

const elk = new ELK();

export const NODE_W: Record<string, number> = {
  workspace: 180,
  pluginGroup: 150,
  plugin: 140,
  mcp: 150,
  claudeMd: 140,
  skill: 150,
  hook: 170,
  memory: 150,
  rule: 130,
  permission: 170,
  configFile: 140,
  tool: 100,
  env: 110,
};

export const NODE_H: Record<string, number> = {
  workspace: 80,
  pluginGroup: 60,
  plugin: 56,
  mcp: 60,
  claudeMd: 52,
  skill: 60,
  hook: 60,
  memory: 56,
  rule: 50,
  permission: 56,
  configFile: 52,
  tool: 38,
  env: 38,
};

export const LAYER_LABELS: Record<number, { label: string; accent: string }> = {
  0: { label: "Foundation", accent: "rgba(236, 72, 153, 0.55)" },
  1: { label: "Declared", accent: "rgba(20, 184, 166, 0.55)" },
  2: { label: "Composed", accent: "rgba(245, 158, 11, 0.55)" },
  3: { label: "Claude Code", accent: "rgba(139, 92, 246, 0.7)" },
  4: { label: "Events", accent: "rgba(239, 68, 68, 0.55)" },
  5: { label: "Runtime", accent: "rgba(34, 211, 238, 0.55)" },
  6: { label: "Config files", accent: "rgba(250, 204, 21, 0.55)" },
};

// Loading order (left -> right) with Claude Code itself as the central
// destination. Declarations and composed entities sit to its left in the
// order Claude reads them; runtime artifacts sit to its right in the order
// Claude triggers them.
//
//   L0 foundation context   ->  CLAUDE.md, rules
//   L1 declared sources     ->  plugins, env
//   L2 composed entities    ->  skills, MCP servers, memory
//   L3 the assembled agent  ->  Claude Code (workspace node)
//   L4 event handlers       ->  hooks
//   L5 runtime invocations  ->  tools, permissions
//   L6 declaration sources  ->  config files
export const LOADING_LAYER: Record<string, number> = {
  claudeMd: 0,
  rule: 0,
  plugin: 1,
  pluginGroup: 1,
  env: 1,
  skill: 2,
  mcp: 2,
  memory: 2,
  workspace: 3,
  hook: 4,
  tool: 5,
  permission: 5,
  configFile: 6,
};

export type LayoutDirection = "RIGHT" | "DOWN";

export async function layoutNodes<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: LayoutDirection = "RIGHT",
): Promise<Node<T>[]> {
  if (nodes.length === 0) return nodes;

  // Partition nodes: parents (categoryGroup) at root, entities under their parent
  const parents = nodes.filter((n) => n.type === "categoryGroup");
  const children = nodes.filter((n) => n.type !== "categoryGroup");

  const childrenByParent = new Map<string, Node<T>[]>();
  const orphans: Node<T>[] = [];
  for (const c of children) {
    const pid = c.parentId;
    if (pid && parents.some((p) => p.id === pid)) {
      const arr = childrenByParent.get(pid) ?? [];
      arr.push(c);
      childrenByParent.set(pid, arr);
    } else {
      orphans.push(c);
    }
  }

  const elkChildren: ElkNode[] = [];

  // Orphan entities live at root level
  for (const o of orphans) {
    const kind = ((o.data as { kind?: string })?.kind ?? "skill") as string;
    elkChildren.push({
      id: o.id,
      width: NODE_W[kind] ?? 180,
      height: NODE_H[kind] ?? 80,
      layoutOptions: { "elk.partitioning.partition": String(LOADING_LAYER[kind] ?? 3) },
    });
  }

  // categoryGroup parents with their children nested. When collapsed (no
  // children passed in) they render as a compact summary card instead of a
  // container, so we give ELK a sized leaf to lay out.
  for (const p of parents) {
    const groupKind = ((p.data as { kind?: string })?.kind ?? "skill") as string;
    const layer = LOADING_LAYER[groupKind] ?? 3;
    const kids = childrenByParent.get(p.id) ?? [];
    if (kids.length === 0) {
      elkChildren.push({
        id: p.id,
        width: 170,
        height: 68,
        layoutOptions: { "elk.partitioning.partition": String(layer) },
      });
      continue;
    }
    const inner = kids.map((c) => ({
      id: c.id,
      width: NODE_W[groupKind] ?? 180,
      height: NODE_H[groupKind] ?? 80,
    }));
    elkChildren.push({
      id: p.id,
      layoutOptions: {
        "elk.partitioning.partition": String(layer),
        "elk.padding": "[top=26,left=8,bottom=8,right=8]",
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.aspectRatio": "0.5",
        "elk.spacing.nodeNode": "8",
        "elk.layered.spacing.nodeNodeBetweenLayers": "14",
      },
      children: inner,
    });
  }

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
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.partitioning.activate": "true",
        "elk.layered.spacing.nodeNodeBetweenLayers": "60",
        "elk.spacing.nodeNode": "24",
        "elk.spacing.componentComponent": "40",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.edgeRouting": "POLYLINE",
        "elk.layered.thoroughness": "30",
        "elk.padding": "[top=20,left=20,bottom=20,right=20]",
      },
      children: elkChildren,
      edges: elkEdges,
    });

    return mapPositions(nodes, result);
  } catch {
    return fallbackGrid(nodes);
  }
}

function mapPositions<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  result: ElkNode,
): Node<T>[] {
  // For root-level: absolute. For nested: relative to parent (react-flow expects this when parentId is set).
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();

  for (const child of result.children ?? []) {
    if (typeof child.x === "number" && typeof child.y === "number") {
      positions.set(child.id, {
        x: child.x,
        y: child.y,
        width: child.width ?? 180,
        height: child.height ?? 80,
      });
      for (const inner of child.children ?? []) {
        if (typeof inner.x === "number" && typeof inner.y === "number") {
          positions.set(inner.id, {
            x: inner.x,
            y: inner.y,
            width: inner.width ?? 180,
            height: inner.height ?? 80,
          });
        }
      }
    }
  }

  return nodes.map((n) => {
    const p = positions.get(n.id);
    if (!p) return n;
    const next: Node<T> = { ...n, position: { x: p.x, y: p.y } };
    if (n.type === "categoryGroup") {
      next.style = {
        ...(n.style ?? {}),
        width: p.width,
        height: p.height,
      };
    }
    return next;
  });
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
