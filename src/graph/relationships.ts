import type { Harness, Permission, Source } from "../parser/types.js";
import type { GraphEdge } from "./elements.js";

const SOURCE_PRECEDENCE: readonly Source[] = ["project", "local", "user", "plugin"];

export interface RelationshipBuildResult {
  edges: GraphEdge[];
  toolNodes: Set<string>;
  configFileNodes: Set<string>;
}

export function buildRelationships(harness: Harness): RelationshipBuildResult {
  const edges: GraphEdge[] = [];
  const toolNodes = new Set<string>();
  const configFileNodes = new Set<string>();
  const seen = new Set<string>();

  const push = (edge: GraphEdge): void => {
    if (seen.has(edge.data.id)) return;
    seen.add(edge.data.id);
    edges.push(edge);
  };

  for (const skill of harness.skills) {
    if (skill.pluginNamespace && skill.pluginName) {
      const groupId = `pluginGroup::${skill.pluginNamespace}::${skill.pluginName}`;
      push(makeEdge(groupId, `skill::${skill.id}`, "owns"));
    }
  }

  collectShadows(harness.skills, "skill", (s) => s.name, push);
  collectShadows(
    harness.hooks,
    "hook",
    (h) => `${h.event}::${h.matcher ?? ""}::${h.command}`,
    push,
  );
  collectShadows(harness.mcpServers, "mcp", (m) => m.name, push);
  collectShadows(harness.memory, "memory", (m) => m.name, push);
  collectShadows(harness.rules, "rule", (r) => r.name, push);
  collectShadows(harness.claudeMd, "claudeMd", (c) => c.kind, push);

  collectConflicts(harness.permissions, push);

  const mcpServersByName = new Map<string, string>();
  for (const mcp of harness.mcpServers) {
    if (!mcpServersByName.has(mcp.name)) {
      mcpServersByName.set(mcp.name, mcp.id);
    }
  }

  for (const skill of harness.skills) {
    for (const tool of skill.tools ?? []) {
      const target = resolveToolTarget(tool, mcpServersByName);
      if (target.kind === "tool") toolNodes.add(target.name);
      push(makeEdge(`skill::${skill.id}`, target.id, "requires-tool"));
    }
    for (const ref of skill.mcpRefs ?? []) {
      const mcpId = mcpServersByName.get(ref);
      if (!mcpId) continue;
      push(makeEdge(`skill::${skill.id}`, `mcp::${mcpId}`, "references"));
    }
  }

  const skillNamesById = new Map<string, string>();
  for (const skill of harness.skills) {
    if (!skillNamesById.has(skill.name)) {
      skillNamesById.set(skill.name, skill.id);
    }
  }

  for (const hook of harness.hooks) {
    for (const slash of extractSlashCommands(hook.command)) {
      const skillId = skillNamesById.get(slash);
      if (!skillId) continue;
      push(makeEdge(`hook::${hook.id}`, `skill::${skillId}`, "invokes"));
    }
  }

  collectDeclaredIn(harness, configFileNodes, push);

  return { edges, toolNodes, configFileNodes };
}

interface ShadowItem {
  id: string;
  source: Source;
}

function collectShadows<T extends ShadowItem>(
  items: T[],
  kind: string,
  keyOf: (item: T) => string,
  push: (edge: GraphEdge) => void,
): void {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort(
      (a, b) => SOURCE_PRECEDENCE.indexOf(a.source) - SOURCE_PRECEDENCE.indexOf(b.source),
    );
    const top = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].source === top.source) continue;
      push(makeEdge(`${kind}::${top.id}`, `${kind}::${sorted[i].id}`, "overrides"));
    }
  }
}

function collectConflicts(permissions: Permission[], push: (edge: GraphEdge) => void): void {
  const groups = new Map<string, { allow: Permission[]; deny: Permission[] }>();
  for (const perm of permissions) {
    const bucket = groups.get(perm.pattern) ?? { allow: [], deny: [] };
    if (perm.mode === "allow") bucket.allow.push(perm);
    else bucket.deny.push(perm);
    groups.set(perm.pattern, bucket);
  }
  for (const { allow, deny } of groups.values()) {
    if (allow.length === 0 || deny.length === 0) continue;
    for (const a of allow) {
      for (const d of deny) {
        push(makeEdge(`permission::${a.id}`, `permission::${d.id}`, "conflicts"));
      }
    }
  }
}

function collectDeclaredIn(
  harness: Harness,
  configFileNodes: Set<string>,
  push: (edge: GraphEdge) => void,
): void {
  const declarable: Array<{ kind: string; id: string; path: string }> = [];
  for (const hook of harness.hooks) declarable.push({ kind: "hook", id: hook.id, path: hook.path });
  for (const mcp of harness.mcpServers)
    declarable.push({ kind: "mcp", id: mcp.id, path: mcp.path });

  const counts = new Map<string, number>();
  for (const d of declarable) {
    if (!d.path) continue;
    counts.set(d.path, (counts.get(d.path) ?? 0) + 1);
  }

  for (const d of declarable) {
    if (!d.path) continue;
    if ((counts.get(d.path) ?? 0) < 2) continue;
    configFileNodes.add(d.path);
    push(makeEdge(`${d.kind}::${d.id}`, `configFile::${d.path}`, "declared-in"));
  }
}

interface ToolTarget {
  kind: "tool" | "mcp";
  id: string;
  name: string;
}

function resolveToolTarget(token: string, mcpByName: Map<string, string>): ToolTarget {
  const match = /^mcp__([a-z0-9_-]+)__([a-z0-9_-]+)$/i.exec(token);
  if (match) {
    const server = match[1];
    const mcpId = mcpByName.get(server);
    if (mcpId) {
      return { kind: "mcp", id: `mcp::${mcpId}`, name: server };
    }
  }
  return { kind: "tool", id: `tool::${token}`, name: token };
}

const SLASH_RE = /(?:^|[\s'"`])\/([a-z0-9][a-z0-9_-]{1,})/gi;

function extractSlashCommands(command: string): string[] {
  const out = new Set<string>();
  for (const match of command.matchAll(SLASH_RE)) {
    out.add(match[1]);
  }
  return [...out];
}

function makeEdge(source: string, target: string, relation: string): GraphEdge {
  return {
    data: {
      id: `${source}->${target}::${relation}`,
      source,
      target,
      relation,
      kind: "relationship",
    },
  };
}
