import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

const NODE_WIDTH: Record<string, number> = {
  workspace: 200,
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

const NODE_HEIGHT: Record<string, number> = {
  workspace: 90,
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

export function layoutNodes<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: "LR" | "TB" = "LR",
): Node<T>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });

  for (const n of nodes) {
    const kind = ((n.data as { kind?: string })?.kind ?? "skill") as string;
    g.setNode(n.id, {
      width: NODE_WIDTH[kind] ?? 180,
      height: NODE_HEIGHT[kind] ?? 80,
    });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return {
      ...n,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
    };
  });
}
