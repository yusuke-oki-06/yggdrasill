import * as vscode from "vscode";
import type { Harness } from "../../parser/types.js";

export type HarnessNode =
  | { kind: "category"; label: string; category: Category; count: number }
  | { kind: "leaf"; label: string; description?: string; tooltip?: string; resource?: vscode.Uri }
  | { kind: "issue"; label: string; description?: string; tooltip?: string };

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
      const item = new vscode.TreeItem(
        `${element.label} (${element.count})`,
        element.count > 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon(iconForCategory(element.category));
      item.contextValue = `yggdrasil.category.${element.category}`;
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
    if (!harness) {
      return [];
    }

    if (!element) {
      return (Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => ({
        kind: "category" as const,
        category: cat,
        label: CATEGORY_LABEL[cat],
        count: this.countFor(cat, harness),
      }));
    }

    if (element.kind !== "category") {
      return [];
    }

    return this.childrenFor(element.category, harness);
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

  private childrenFor(category: Category, h: Harness): HarnessNode[] {
    switch (category) {
      case "skills":
        return h.skills.map((s) => ({
          kind: "leaf" as const,
          label: s.name,
          description: s.source,
          tooltip: s.description || s.path,
          resource: vscode.Uri.file(s.path),
        }));
      case "hooks":
        return h.hooks.map((hook) => ({
          kind: "leaf" as const,
          label: hook.event,
          description: hook.matcher ? `${hook.matcher} · ${hook.command}` : hook.command,
          tooltip: `${hook.event} (${hook.source})\n${hook.command}`,
          resource: vscode.Uri.file(hook.path),
        }));
      case "mcpServers":
        return h.mcpServers.map((m) => ({
          kind: "leaf" as const,
          label: m.name,
          description: `${m.type} · ${m.source}`,
          tooltip: m.command ?? m.url ?? "",
          resource: vscode.Uri.file(m.path),
        }));
      case "memory":
        return h.memory.map((m) => ({
          kind: "leaf" as const,
          label: m.name,
          description: m.type,
          tooltip: m.description ?? m.path,
          resource: vscode.Uri.file(m.path),
        }));
      case "plugins":
        return h.plugins.map((p) => ({
          kind: "leaf" as const,
          label: p.name,
          description: `${p.enabled ? "enabled" : "disabled"} · ${p.source}`,
        }));
      case "permissions":
        return h.permissions.map((p) => ({
          kind: "leaf" as const,
          label: p.pattern,
          description: `${p.mode} · ${p.source}`,
        }));
      case "rules":
        return h.rules.map((r) => ({
          kind: "leaf" as const,
          label: r.name,
          description: r.source,
          resource: vscode.Uri.file(r.path),
        }));
      case "claudeMd":
        return h.claudeMd.map((d) => ({
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
        return h.issues.map((issue, idx) => ({
          kind: "issue" as const,
          label: `${issue.severity}: ${issue.message}`,
          description: issue.path ? shortenPath(issue.path) : undefined,
          tooltip: issue.path,
          id: String(idx),
        }));
    }
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

function shortenPath(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts.slice(-2).join("/");
}
