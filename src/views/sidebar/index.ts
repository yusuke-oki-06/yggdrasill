import * as vscode from "vscode";
import { analyzeHarness } from "../../analyzer/index.js";
import type { Inconsistency } from "../../analyzer/types.js";
import { parseHarness, type Harness } from "../../parser/index.js";
import { HarnessTreeProvider } from "./harnessTreeProvider.js";

const REFRESH_DEBOUNCE_MS = 250;

export interface SidebarHandle {
  provider: HarnessTreeProvider;
  refresh(): void;
}

export function registerSidebar(
  context: vscode.ExtensionContext,
  diagnostics: vscode.DiagnosticCollection,
): SidebarHandle {
  const provider = new HarnessTreeProvider();
  const treeView = vscode.window.createTreeView("yggdrasil.harness", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const refresher = new DebouncedRefresher(provider, diagnostics, REFRESH_DEBOUNCE_MS);
  context.subscriptions.push({ dispose: () => refresher.dispose() });

  refresher.requestRefresh();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => refresher.requestRefresh()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("yggdrasil.parser.memoryRoot")) {
        refresher.requestRefresh();
      }
    }),
  );

  const watcher = vscode.workspace.createFileSystemWatcher(
    "{**/.claude/**/*,**/.mcp.json,**/CLAUDE.md,**/AGENTS.md,**/MEMORY.md}",
  );
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(() => refresher.requestRefresh()),
    watcher.onDidCreate(() => refresher.requestRefresh()),
    watcher.onDidDelete(() => refresher.requestRefresh()),
  );

  return {
    provider,
    refresh: () => refresher.requestRefresh(),
  };
}

class DebouncedRefresher {
  private timer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(
    private readonly provider: HarnessTreeProvider,
    private readonly diagnostics: vscode.DiagnosticCollection,
    private readonly delay: number,
  ) {}

  requestRefresh(): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), this.delay);
  }

  private async refresh(): Promise<void> {
    if (this.disposed) return;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.provider.setHarness(null);
      this.diagnostics.clear();
      return;
    }
    const memoryRoot = vscode.workspace
      .getConfiguration("yggdrasil")
      .get<string>("parser.memoryRoot");
    const workspace = folders[0].uri.fsPath;
    try {
      const harness: Harness = await parseHarness(workspace, {
        memoryRoot: memoryRoot && memoryRoot.length > 0 ? memoryRoot : undefined,
      });
      if (this.disposed) return;
      const inconsistencies = await analyzeHarness(harness);
      if (this.disposed) return;
      this.provider.setHarness(harness);
      this.provider.setInconsistencies(inconsistencies);
      publishDiagnostics(this.diagnostics, workspace, inconsistencies);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Yggdrasil: failed to parse harness: ${(err as Error).message}`,
      );
      if (!this.disposed) {
        this.provider.setHarness(null);
        this.diagnostics.clear();
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
  }
}

function publishDiagnostics(
  collection: vscode.DiagnosticCollection,
  workspace: string,
  inconsistencies: Inconsistency[],
): void {
  collection.clear();
  const byPath = new Map<string, vscode.Diagnostic[]>();
  const fallback = vscode.Uri.file(workspace).with({ fragment: "yggdrasil" });

  for (const inc of inconsistencies) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      inc.message,
      toSeverity(inc.severity),
    );
    diag.source = "Yggdrasil";
    diag.code = inc.rule;
    const key = inc.path ?? fallback.toString();
    const arr = byPath.get(key);
    if (arr) {
      arr.push(diag);
    } else {
      byPath.set(key, [diag]);
    }
  }

  for (const [key, diags] of byPath) {
    const uri = key === fallback.toString() ? fallback : vscode.Uri.file(key);
    collection.set(uri, diags);
  }
}

function toSeverity(severity: Inconsistency["severity"]): vscode.DiagnosticSeverity {
  switch (severity) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "info":
      return vscode.DiagnosticSeverity.Information;
  }
}
