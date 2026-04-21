import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { CategoryGroupNode, type CategoryGroupData } from "./components/CategoryGroupNode.js";
import { HarnessNode, type HarnessNodeData } from "./components/HarnessNode.js";
import { Toolbar, type ToolbarFilters } from "./components/Toolbar.js";
import { fallbackGrid, layoutNodes, LOADING_LAYER } from "./layout.js";
import type {
  EdgeData,
  FromExtensionMessage,
  NodeData,
  ToExtensionMessage,
  VsCodeApi,
} from "./types.js";

const RELATION_COLOR: Record<string, string> = {
  owns: "#2dd4bf",
  overrides: "#f59e0b",
  conflicts: "#ef4444",
  "requires-tool": "#22d3ee",
  references: "#a855f7",
  invokes: "#84cc16",
  "declared-in": "#94a3b8",
};

const RELATION_WIDTH: Record<string, number> = {
  overrides: 3,
  conflicts: 3,
  owns: 1.4,
  "requires-tool": 1.6,
  references: 1.6,
  invokes: 1.6,
  "declared-in": 1.2,
};

const NODE_TYPES = { harness: HarnessNode, categoryGroup: CategoryGroupNode };

// Kinds that should NOT be wrapped in a category group (already singleton or
// kept independent so cross-category edges read cleanly).
const SOLO_KINDS = new Set<string>(["workspace"]);
const MIN_GROUP_SIZE = 2;

// Sort entities within a compound by source precedence so the highest-priority
// entries (project overrides) sit at the top of each category column.
const SOURCE_ORDER: Record<string, number> = {
  project: 0,
  local: 1,
  user: 2,
  plugin: 3,
};

interface AppProps {
  vscode: VsCodeApi;
}

export function App({ vscode }: AppProps): JSX.Element {
  return (
    <ReactFlowProvider>
      <Inner vscode={vscode} />
    </ReactFlowProvider>
  );
}

function Inner({ vscode }: AppProps): JSX.Element {
  const [rawNodes, setRawNodes] = useState<NodeData[]>([]);
  const [rawEdges, setRawEdges] = useState<EdgeData[]>([]);
  const [issueIds, setIssueIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ToolbarFilters>({
    query: "",
    showPlugins: false,
    showEnv: false,
    showPerms: false,
    layout: "RIGHT",
  });
  const [graphNodes, setGraphNodes] = useState<Node<HarnessNodeData | CategoryGroupData>[]>([]);
  const [graphEdges, setGraphEdges] = useState<Edge[]>([]);
  const [stats, setStats] = useState("");
  const [layoutBusy, setLayoutBusy] = useState(false);
  const flow = useReactFlow();
  const sentRef = useRef<{ plugins?: boolean; env?: boolean; perms?: boolean }>({});

  useEffect(() => {
    const handler = (event: MessageEvent<FromExtensionMessage>): void => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === "update") {
        setRawNodes(msg.elements.nodes.map((n) => n.data));
        setRawEdges(msg.elements.edges.map((e) => e.data));
        setIssueIds(new Set(msg.issueTargets));
      }
    };
    window.addEventListener("message", handler);
    post(vscode, { type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, [vscode]);

  useEffect(() => {
    if (sentRef.current.plugins !== filters.showPlugins) {
      sentRef.current.plugins = filters.showPlugins;
      post(vscode, { type: "setIncludePluginSkills", value: filters.showPlugins });
    }
  }, [filters.showPlugins, vscode]);

  useEffect(() => {
    if (sentRef.current.env !== filters.showEnv) {
      sentRef.current.env = filters.showEnv;
      post(vscode, { type: "setIncludeEnv", value: filters.showEnv });
    }
  }, [filters.showEnv, vscode]);

  useEffect(() => {
    if (sentRef.current.perms !== filters.showPerms) {
      sentRef.current.perms = filters.showPerms;
      post(vscode, { type: "setIncludePermissions", value: filters.showPerms });
    }
  }, [filters.showPerms, vscode]);

  useEffect(() => {
    let cancelled = false;
    const q = filters.query.trim().toLowerCase();

    const entityNodes: Node<HarnessNodeData>[] = rawNodes.map((data) => ({
      id: data.id,
      type: "harness",
      position: { x: 0, y: 0 },
      data: { payload: data, hasIssue: issueIds.has(data.id) },
    }));

    // Group entities by kind; emit categoryGroup parents for each kind that
    // has >=2 nodes and isn't on the SOLO list, then attach parentId to
    // children. ELK + react-flow render parents as labeled containers.
    const byKind = new Map<string, Node<HarnessNodeData>[]>();
    for (const n of entityNodes) {
      const k = n.data.payload.kind;
      const arr = byKind.get(k) ?? [];
      arr.push(n);
      byKind.set(k, arr);
    }

    const groupNodes: Node<CategoryGroupData>[] = [];
    const wiredEntities: Node<HarnessNodeData>[] = [];
    for (const [kind, list] of byKind) {
      if (SOLO_KINDS.has(kind) || list.length < MIN_GROUP_SIZE) {
        wiredEntities.push(...list);
        continue;
      }
      const groupId = `categoryGroup::${kind}`;
      groupNodes.push({
        id: groupId,
        type: "categoryGroup",
        position: { x: 0, y: 0 },
        data: {
          kind,
          count: list.length,
          layer: LOADING_LAYER[kind] ?? 3,
        },
        zIndex: -1,
      });
      const sorted = [...list].sort((a, b) => {
        const sa = SOURCE_ORDER[a.data.payload.source ?? "project"] ?? 99;
        const sb = SOURCE_ORDER[b.data.payload.source ?? "project"] ?? 99;
        if (sa !== sb) return sa - sb;
        return a.data.payload.label.localeCompare(b.data.payload.label);
      });
      for (const e of sorted) {
        wiredEntities.push({ ...e, parentId: groupId, extent: "parent" });
      }
    }

    // Parents must come before their children in react-flow's array
    const baseNodes: Node<HarnessNodeData | CategoryGroupData>[] = [
      ...groupNodes,
      ...wiredEntities,
    ];

    const baseEdges: Edge[] = rawEdges.map((data) => ({
      id: data.id,
      source: data.source,
      target: data.target,
      label: data.kind === "relationship" ? data.relation : undefined,
      animated: data.kind === "relationship",
      style:
        data.kind === "relationship"
          ? {
              stroke: RELATION_COLOR[data.relation] ?? "#a855f7",
              strokeWidth: RELATION_WIDTH[data.relation] ?? 1.6,
            }
          : { stroke: "rgba(150,150,150,0.3)", strokeWidth: 0.8 },
      labelStyle: {
        fontSize: data.relation === "overrides" || data.relation === "conflicts" ? 11 : 10,
        fill:
          data.relation === "overrides"
            ? "#fde68a"
            : data.relation === "conflicts"
              ? "#fecaca"
              : "#cbd5f5",
        fontWeight: data.relation === "overrides" || data.relation === "conflicts" ? 600 : 400,
      },
      labelBgStyle: { fill: "rgba(15,23,42,0.85)" },
    }));

    if (baseNodes.length === 0) {
      setGraphNodes([]);
      setGraphEdges([]);
      setStats("");
      return;
    }

    setLayoutBusy(true);
    const apply = (positioned: Node<HarnessNodeData | CategoryGroupData>[]): void => {
      if (cancelled) return;
      let finalNodes = positioned;
      const finalEdges = baseEdges;

      if (q.length > 0) {
        const matched = new Set<string>();
        for (const n of finalNodes) {
          if (n.type !== "harness") continue;
          const data = (n.data as HarnessNodeData).payload;
          if (
            data.label.toLowerCase().includes(q) ||
            (data.description ?? "").toLowerCase().includes(q)
          ) {
            matched.add(n.id);
          }
        }
        for (const e of finalEdges) {
          if (matched.has(e.source) || matched.has(e.target)) {
            matched.add(e.source);
            matched.add(e.target);
          }
        }
        finalNodes = finalNodes.map((n) =>
          n.type === "categoryGroup" || matched.has(n.id)
            ? n
            : { ...n, style: { ...(n.style ?? {}), opacity: 0.18 } },
        );
        for (const e of finalEdges) {
          if (!matched.has(e.source) || !matched.has(e.target)) {
            e.style = { ...e.style, opacity: 0.1 };
          }
        }
      }

      const entityCount = finalNodes.filter((n) => n.type === "harness").length;
      const groupCount = finalNodes.filter((n) => n.type === "categoryGroup").length;
      const relCount = finalEdges.filter((e) => e.animated).length;
      const issueCount = issueIds.size;
      setGraphNodes(finalNodes);
      setGraphEdges(finalEdges);
      setStats(
        `${entityCount} nodes · ${groupCount} groups · ${finalEdges.length} edges` +
          (relCount ? ` · ${relCount} rel` : "") +
          (issueCount ? ` · ${issueCount} ⚠` : ""),
      );
      setLayoutBusy(false);
    };

    layoutNodes(baseNodes, baseEdges, filters.layout)
      .then(apply)
      .catch(() => apply(fallbackGrid(baseNodes)));

    return () => {
      cancelled = true;
    };
  }, [rawNodes, rawEdges, issueIds, filters.query, filters.layout]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type !== "harness") return;
      const data = node.data as HarnessNodeData | undefined;
      const path = data?.payload?.path;
      if (path) post(vscode, { type: "openFile", path });
    },
    [vscode],
  );

  const onChangeFilter = useCallback((next: Partial<ToolbarFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const onFit = useCallback(() => {
    flow.fitView({ duration: 250, padding: 0.2 });
  }, [flow]);

  useEffect(() => {
    if (graphNodes.length === 0) return;
    const t = window.setTimeout(() => flow.fitView({ padding: 0.2 }), 60);
    return () => window.clearTimeout(t);
  }, [graphNodes, flow]);

  return (
    <div className="app">
      <Toolbar filters={filters} stats={stats} onChange={onChangeFilter} onFit={onFit} />
      <div className="canvas">
        <ReactFlow
          nodes={graphNodes}
          edges={graphEdges}
          nodeTypes={NODE_TYPES}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(148,163,184,0.18)" gap={24} size={1} />
          <Controls position="bottom-right" showInteractive={false} />
          <MiniMap
            position="bottom-left"
            zoomable
            pannable
            maskColor="rgba(15,23,42,0.65)"
            nodeColor={(n) => {
              if (n.type === "categoryGroup") {
                const kind = (n.data as CategoryGroupData | undefined)?.kind ?? "skill";
                return KIND_MINIMAP[kind] ?? "#888";
              }
              const kind = (n.data as HarnessNodeData | undefined)?.payload?.kind ?? "skill";
              return KIND_MINIMAP[kind] ?? "#888";
            }}
          />
        </ReactFlow>
        {layoutBusy && graphNodes.length === 0 ? (
          <div className="layout-busy">computing layout…</div>
        ) : null}
      </div>
    </div>
  );
}

const KIND_MINIMAP: Record<string, string> = {
  workspace: "#7c3aed",
  skill: "#f59e0b",
  pluginGroup: "#14b8a6",
  hook: "#ef4444",
  mcp: "#3b82f6",
  memory: "#a855f7",
  permission: "#6b7280",
  rule: "#38bdf8",
  claudeMd: "#ec4899",
  env: "#84cc16",
  plugin: "#14b8a6",
  tool: "#22d3ee",
  configFile: "#facc15",
};

function post(vscode: VsCodeApi, msg: ToExtensionMessage): void {
  vscode.postMessage(msg);
}
