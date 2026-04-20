import * as vscode from "vscode";
import type { Harness, Source } from "../../parser/types.js";

export type Category =
  | "skills"
  | "hooks"
  | "mcpServers"
  | "memory"
  | "plugins"
  | "permissions"
  | "rules"
  | "claudeMd"
  | "env"
  | "issues";

export type HarnessNode =
  | { kind: "category"; category: Category; label: string; count: number }
  | { kind: "sourceGroup"; category: Category; source: Source; label: string; count: number }
  | {
      kind: "pluginGroup";
      category: Category;
      pluginNamespace: string;
      pluginName: string;
      label: string;
      count: number;
    }
  | {
      kind: "leaf";
      label: string;
      description?: string;
      tooltip?: string;
      resource?: vscode.Uri;
    }
  | { kind: "issue"; label: string; description?: string; tooltip?: string };

const CATEGORY_LABEL: Record<Category, string> = {
  skills: "Skills",
  hooks: "Hooks",
  mcpServers: "MCP Servers",
  memory: "Memory",
  plugins: "Plugins",
  permissions: "Permissions",
  rules: "Rules",
  claudeMd: "CLAUDE.md / AGENTS.md",
  env: "Environment",
  issues: "Issues",
};

const CATEGORY_BY_SOURCE: ReadonlySet<Category> = new Set<Category>([
  "skills",
  "hooks",
  "mcpServers",
  "plugins",
  "permissions",
  "rules",
  "claudeMd",
  "memory",
]);

const SOURCE_ORDER: readonly Source[] = ["project", "local", "user", "plugin"];

const SOURCE_LABEL: Record<Source, string> = {
  project: "Project",
  local: "Local",
  user: "User",
  plugin: "Plugin",
};

const AUTO_COLLAPSE_THRESHOLD = 20;

export class HarnessTreeProvider implements vscode.TreeDataProvider<HarnessNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<HarnessNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private harness: Harness | null = null;

  setHarness(harness: Harness | null): void {
    this.harness = harness;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: HarnessNode): vscode.TreeItem {
    if (element.kind === "category") {
      const state =
        element.count === 0
          ? vscode.TreeItemCollapsibleState.None
          : element.count > AUTO_COLLAPSE_THRESHOLD
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.Expanded;
      const item = new vscode.TreeItem(`${element.label} (${element.count})`, state);
      item.iconPath = new vscode.ThemeIcon(iconForCategory(element.category));
      item.contextValue = `yggdrasil.category.${element.category}`;
      return item;
    }

    if (element.kind === "sourceGroup") {
      const item = new vscode.TreeItem(
        `${element.label} (${element.count})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = new vscode.ThemeIcon(iconForSource(element.source));
      item.contextValue = `yggdrasil.source.${element.source}`;
      return item;
    }

    if (element.kind === "pluginGroup") {
      const item = new vscode.TreeItem(
        `${element.label} (${element.count})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.description = element.pluginNamespace;
      item.tooltip = `${element.pluginNamespace}/${element.pluginName}`;
      item.iconPath = new vscode.ThemeIcon("package");
      item.contextValue = `yggdrasil.plugin.${element.pluginNamespace}.${element.pluginName}`;
      return item;
    }

    if (element.kind === "issue") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
      item.description = element.description;
      item.tooltip = element.tooltip;
      item.iconPath = new vscode.ThemeIcon("warning");
      return item;
    }

    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = element.description;
    item.tooltip = element.tooltip;
    if (element.resource) {
      item.resourceUri = element.resource;
      item.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [element.resource],
      };
    }
    return item;
  }

  getChildren(element?: HarnessNode): HarnessNode[] {
    const harness = this.harness;
    if (!harness) return [];

    if (!element) {
      return (Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => ({
        kind: "category" as const,
        category: cat,
        label: CATEGORY_LABEL[cat],
        count: this.countFor(cat, harness),
      }));
    }

    if (element.kind === "category") {
      return this.childrenForCategory(element.category, harness);
    }

    if (element.kind === "sourceGroup") {
      if (element.category === "skills" && element.source === "plugin") {
        const pluginGroups = groupSkillsByPlugin(harness);
        if (pluginGroups.length >= 2) return pluginGroups;
      }
      return leavesFor(element.category, harness, element.source);
    }

    if (element.kind === "pluginGroup") {
      return harness.skills
        .filter(
          (s) =>
            s.source === "plugin" &&
            (s.pluginNamespace ?? "") === element.pluginNamespace &&
            (s.pluginName ?? "") === element.pluginName,
        )
        .map((s) => ({
          kind: "leaf" as const,
          label: s.name,
          description: s.pluginName,
          tooltip: s.description || s.path,
          resource: vscode.Uri.file(s.path),
        }));
    }

    return [];
  }

  private countFor(category: Category, h: Harness): number {
    switch (category) {
      case "skills":
        return h.skills.length;
      case "hooks":
        return h.hooks.length;
      case "mcpServers":
        return h.mcpServers.length;
      case "memory":
        return h.memory.length;
      case "plugins":
        return h.plugins.length;
      case "permissions":
        return h.permissions.length;
      case "rules":
        return h.rules.length;
      case "claudeMd":
        return h.claudeMd.length;
      case "env":
        return Object.keys(h.env).length;
      case "issues":
        return h.issues.length;
    }
  }

  private childrenForCategory(category: Category, h: Harness): HarnessNode[] {
    if (CATEGORY_BY_SOURCE.has(category)) {
      const sources = sourcesForCategory(category, h);
      if (sources.size >= 2) {
        const groups: HarnessNode[] = [];
        for (const source of SOURCE_ORDER) {
          const count = sources.get(source) ?? 0;
          if (count === 0) continue;
          groups.push({
            kind: "sourceGroup",
            category,
            source,
            label: SOURCE_LABEL[source],
            count,
          });
        }
        return groups;
      }
    }
    return leavesFor(category, h);
  }
}

function groupSkillsByPlugin(h: Harness): HarnessNode[] {
  const counts = new Map<string, { namespace: string; plugin: string; count: number }>();
  for (const s of h.skills) {
    if (s.source !== "plugin") continue;
    const namespace = s.pluginNamespace ?? "";
    const plugin = s.pluginName ?? "";
    const key = `${namespace}::${plugin}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { namespace, plugin, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.plugin.localeCompare(b.plugin))
    .map((g) => ({
      kind: "pluginGroup" as const,
      category: "skills" as const,
      pluginNamespace: g.namespace,
      pluginName: g.plugin,
      label: g.plugin || "(unknown)",
      count: g.count,
    }));
}

function sourcesForCategory(category: Category, h: Harness): Map<Source, number> {
  const counts = new Map<Source, number>();
  const bump = (s: Source): void => {
    counts.set(s, (counts.get(s) ?? 0) + 1);
  };
  switch (category) {
    case "skills":
      h.skills.forEach((s) => bump(s.source));
      break;
    case "hooks":
      h.hooks.forEach((s) => bump(s.source));
      break;
    case "mcpServers":
      h.mcpServers.forEach((s) => bump(s.source));
      break;
    case "plugins":
      h.plugins.forEach((s) => bump(s.source));
      break;
    case "permissions":
      h.permissions.forEach((s) => bump(s.source));
      break;
    case "rules":
      h.rules.forEach((s) => bump(s.source));
      break;
    case "claudeMd":
      h.claudeMd.forEach((s) => bump(s.source));
      break;
    case "memory":
      h.memory.forEach((s) => bump(s.source));
      break;
    default:
      break;
  }
  return counts;
}

function leavesFor(category: Category, h: Harness, filter?: Source): HarnessNode[] {
  const pick = <T extends { source: Source }>(items: T[]): T[] =>
    filter ? items.filter((x) => x.source === filter) : items;

  switch (category) {
    case "skills":
      return pick(h.skills).map((s) => ({
        kind: "leaf" as const,
        label: s.name,
        description: s.source,
        tooltip: s.description || s.path,
        resource: vscode.Uri.file(s.path),
      }));
    case "hooks":
      return pick(h.hooks).map((hook) => ({
        kind: "leaf" as const,
        label: hook.event,
        description: hook.matcher ? `${hook.matcher} · ${hook.command}` : hook.command,
        tooltip: `${hook.event} (${hook.source})\n${hook.command}`,
        resource: vscode.Uri.file(hook.path),
      }));
    case "mcpServers":
      return pick(h.mcpServers).map((m) => ({
        kind: "leaf" as const,
        label: m.name,
        description: `${m.type} · ${m.source}`,
        tooltip: m.command ?? m.url ?? "",
        resource: vscode.Uri.file(m.path),
      }));
    case "memory":
      return pick(h.memory).map((m) => ({
        kind: "leaf" as const,
        label: m.name,
        description: m.type,
        tooltip: m.description ?? m.path,
        resource: vscode.Uri.file(m.path),
      }));
    case "plugins":
      return pick(h.plugins).map((p) => ({
        kind: "leaf" as const,
        label: p.name,
        description: `${p.enabled ? "enabled" : "disabled"} · ${p.source}`,
      }));
    case "permissions":
      return pick(h.permissions).map((p) => ({
        kind: "leaf" as const,
        label: p.pattern,
        description: `${p.mode} · ${p.source}`,
      }));
    case "rules":
      return pick(h.rules).map((r) => ({
        kind: "leaf" as const,
        label: r.name,
        description: r.source,
        resource: vscode.Uri.file(r.path),
      }));
    case "claudeMd":
      return pick(h.claudeMd).map((d) => ({
        kind: "leaf" as const,
        label: d.kind,
        description: d.source,
        resource: vscode.Uri.file(d.path),
      }));
    case "env":
      return Object.entries(h.env).map(([k, v]) => ({
        kind: "leaf" as const,
        label: k,
        description: v,
      }));
    case "issues":
      return h.issues.map((issue) => ({
        kind: "issue" as const,
        label: `${issue.severity}: ${issue.message}`,
        description: issue.path ? shortenPath(issue.path) : undefined,
        tooltip: issue.path,
      }));
  }
}

function iconForCategory(category: Category): string {
  switch (category) {
    case "skills":
      return "star";
    case "hooks":
      return "zap";
    case "mcpServers":
      return "plug";
    case "memory":
      return "database";
    case "plugins":
      return "extensions";
    case "permissions":
      return "lock";
    case "rules":
      return "law";
    case "claudeMd":
      return "file-text";
    case "env":
      return "settings-gear";
    case "issues":
      return "warning";
  }
}

function iconForSource(source: Source): string {
  switch (source) {
    case "project":
      return "folder";
    case "local":
      return "folder-opened";
    case "user":
      return "person";
    case "plugin":
      return "extensions";
  }
}

function shortenPath(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts.slice(-2).join("/");
}
