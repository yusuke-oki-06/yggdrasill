import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
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

// Loading order (left -> right) reflecting how Claude Code actually
// composes a session: foundation context first, then declarations,
// then composed entities, finally runtime/boundary artifacts.
export const LOADING_LAYER: Record<string, number> = {
  workspace: 0,
  claudeMd: 1,
  rule: 1,
  plugin: 2,
  pluginGroup: 2,
  env: 2,
  skill: 3,
  mcp: 3,
  memory: 3,
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

  // categoryGroup parents with their children nested
  for (const p of parents) {
    const groupKind = ((p.data as { kind?: string })?.kind ?? "skill") as string;
    const layer = LOADING_LAYER[groupKind] ?? 3;
    const inner = (childrenByParent.get(p.id) ?? []).map((c) => ({
      id: c.id,
      width: NODE_W[groupKind] ?? 180,
      height: NODE_H[groupKind] ?? 80,
    }));
    elkChildren.push({
      id: p.id,
      layoutOptions: {
        "elk.partitioning.partition": String(layer),
        "elk.padding": "[top=42,left=18,bottom=18,right=18]",
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.aspectRatio": "0.7",
        "elk.spacing.nodeNode": "16",
        "elk.layered.spacing.nodeNodeBetweenLayers": "20",
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
        "elk.layered.spacing.nodeNodeBetweenLayers": "100",
        "elk.spacing.nodeNode": "60",
        "elk.spacing.componentComponent": "80",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.edgeRouting": "POLYLINE",
        "elk.layered.thoroughness": "30",
        "elk.padding": "[top=40,left=40,bottom=40,right=40]",
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
