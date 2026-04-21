import * as path from "node:path";
import type { Harness } from "../parser/types.js";
import { buildRelationships } from "./relationships.js";

export type NodeKind =
  | "workspace"
  | "plugin"
  | "skill"
  | "hook"
  | "mcp"
  | "memory"
  | "permission"
  | "rule"
  | "claudeMd"
  | "env"
  | "pluginGroup"
  | "tool"
  | "configFile";

export type EdgeKind = "ownership" | "relationship";

export interface GraphNode {
  data: {
    id: string;
    label: string;
    kind: NodeKind;
    source?: string;
    path?: string;
    description?: string;
    parent?: string;
  };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    relation: string;
    kind: EdgeKind;
  };
}

export interface GraphElements {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BuildOptions {
  includePluginSkills?: boolean;
  includeEnv?: boolean;
  includePermissions?: boolean;
}

const MAX_PLUGIN_SKILLS_PER_PLUGIN = 6;

export function buildGraph(harness: Harness, options: BuildOptions = {}): GraphElements {
  const includePluginSkills = options.includePluginSkills ?? false;
  const includeEnv = options.includeEnv ?? false;
  const includePermissions = options.includePermissions ?? false;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const push = (node: GraphNode): void => {
    if (seen.has(node.data.id)) return;
    seen.add(node.data.id);
    nodes.push(node);
  };

  const workspaceId = "workspace::root";
  push({
    data: {
      id: workspaceId,
      label: basename(harness.workspace) || "workspace",
      kind: "workspace",
      path: harness.workspace,
    },
  });

  for (const doc of harness.claudeMd) {
    const id = nodeId("claudeMd", doc.id);
    push({
      data: {
        id,
        label: doc.kind,
        kind: "claudeMd",
        source: doc.source,
        path: doc.path,
      },
    });
    edges.push(edgeFor(workspaceId, id, "defines"));
  }

  // Note: harness.plugins (settings.json:enabledPlugins) is intentionally NOT
  // rendered as graph nodes — it overlaps almost entirely with pluginGroup
  // (the actually installed plugins providing skills) and the duplication
  // makes the canvas noisy. Enable status is still surfaced via the sidebar,
  // and "enabled but not installed" is reported by the plugin.missing-install
  // analyzer rule.

  addSkills(harness, nodes, edges, workspaceId, seen, includePluginSkills);

  for (const mcp of harness.mcpServers) {
    const id = nodeId("mcp", mcp.id);
    push({
      data: {
        id,
        label: mcp.name,
        kind: "mcp",
        source: mcp.source,
        description: mcp.type,
        path: mcp.path,
      },
    });
    edges.push(edgeFor(workspaceId, id, "connects"));
    if (includeEnv) {
      for (const envKey of mcp.envKeys) {
        const envId = nodeId("env", envKey);
        push({
          data: {
            id: envId,
            label: envKey,
            kind: "env",
            description: harness.env[envKey] ?? "(missing)",
          },
        });
        edges.push(edgeFor(id, envId, "needs-env"));
      }
    }
  }

  for (const hook of harness.hooks) {
    const id = nodeId("hook", hook.id);
    push({
      data: {
        id,
        label: hook.event,
        kind: "hook",
        source: hook.source,
        description: hook.matcher
          ? `${hook.matcher} · ${truncate(hook.command)}`
          : truncate(hook.command),
        path: hook.path,
      },
    });
    edges.push(edgeFor(workspaceId, id, "fires"));
  }

  for (const mem of harness.memory) {
    const id = nodeId("memory", mem.id);
    push({
      data: {
        id,
        label: mem.name,
        kind: "memory",
        source: mem.source,
        description: mem.type,
        path: mem.path,
      },
    });
    edges.push(edgeFor(workspaceId, id, "remembers"));
  }

  if (includePermissions) {
    for (const perm of harness.permissions) {
      const id = nodeId("permission", perm.id);
      push({
        data: {
          id,
          label: truncate(perm.pattern, 48),
          kind: "permission",
          source: perm.source,
          description: perm.mode,
        },
      });
      edges.push(edgeFor(workspaceId, id, perm.mode));
    }
  }

  for (const rule of harness.rules) {
    const id = nodeId("rule", rule.id);
    push({
      data: {
        id,
        label: rule.name,
        kind: "rule",
        source: rule.source,
        path: rule.path,
      },
    });
    edges.push(edgeFor(workspaceId, id, "documents"));
  }

  appendRelationships(harness, nodes, edges, seen);

  return { nodes, edges };
}

function appendRelationships(
  harness: Harness,
  nodes: GraphNode[],
  edges: GraphEdge[],
  seen: Set<string>,
): void {
  const push = (node: GraphNode): void => {
    if (seen.has(node.data.id)) return;
    seen.add(node.data.id);
    nodes.push(node);
  };

  const result = buildRelationships(harness);

  for (const tool of result.toolNodes) {
    push({
      data: {
        id: nodeId("tool", tool),
        label: tool,
        kind: "tool",
      },
    });
  }

  for (const filePath of result.configFileNodes) {
    push({
      data: {
        id: nodeId("configFile", filePath),
        label: path.basename(filePath),
        kind: "configFile",
        path: filePath,
        description: path.basename(path.dirname(filePath)),
      },
    });
  }

  for (const edge of result.edges) {
    if (seen.has(edge.data.id)) continue;
    if (!seen.has(edge.data.source) || !seen.has(edge.data.target)) continue;
    seen.add(edge.data.id);
    edges.push(edge);
  }
}

function addSkills(
  harness: Harness,
  nodes: GraphNode[],
  edges: GraphEdge[],
  workspaceId: string,
  seen: Set<string>,
  includePluginSkills: boolean,
): void {
  const push = (node: GraphNode): void => {
    if (seen.has(node.data.id)) return;
    seen.add(node.data.id);
    nodes.push(node);
  };

  const nonPlugin = harness.skills.filter((s) => s.source !== "plugin");
  for (const skill of nonPlugin) {
    const id = nodeId("skill", skill.id);
    push({
      data: {
        id,
        label: skill.name,
        kind: "skill",
        source: skill.source,
        description: truncate(skill.description, 120),
        path: skill.path,
      },
    });
    edges.push(edgeFor(workspaceId, id, "provides"));
  }

  const pluginSkills = harness.skills.filter((s) => s.source === "plugin");
  const byPlugin = new Map<
    string,
    { namespace: string; plugin: string; items: typeof pluginSkills }
  >();
  for (const s of pluginSkills) {
    const namespace = s.pluginNamespace ?? "";
    const plugin = s.pluginName ?? "";
    const key = `${namespace}::${plugin}`;
    const bucket = byPlugin.get(key);
    if (bucket) {
      bucket.items.push(s);
    } else {
      byPlugin.set(key, { namespace, plugin, items: [s] });
    }
  }

  for (const { namespace, plugin, items } of byPlugin.values()) {
    const groupId = nodeId("pluginGroup", `${namespace}::${plugin}`);
    push({
      data: {
        id: groupId,
        label: plugin || "(unknown)",
        kind: "pluginGroup",
        source: "plugin",
        description: `${namespace} · ${items.length} skill${items.length > 1 ? "s" : ""}`,
      },
    });
    edges.push(edgeFor(workspaceId, groupId, "hosts"));

    if (!includePluginSkills) continue;

    const limited = items.slice(0, MAX_PLUGIN_SKILLS_PER_PLUGIN);
    for (const skill of limited) {
      const id = nodeId("skill", skill.id);
      push({
        data: {
          id,
          label: skill.name,
          kind: "skill",
          source: skill.source,
          description: truncate(skill.description, 120),
          path: skill.path,
          parent: groupId,
        },
      });
      edges.push(edgeFor(groupId, id, "provides"));
    }
  }
}

function edgeFor(
  source: string,
  target: string,
  relation: string,
  kind: EdgeKind = "ownership",
): GraphEdge {
  return {
    data: {
      id: `${source}->${target}::${relation}`,
      source,
      target,
      relation,
      kind,
    },
  };
}

function nodeId(kind: NodeKind, raw: string): string {
  return `${kind}::${raw}`;
}

function truncate(input: string, max = 80): string {
  if (!input) return input;
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}

function basename(p: string): string {
  const cleaned = p.replace(/[\\/]$/, "");
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}
