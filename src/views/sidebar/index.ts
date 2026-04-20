import * as vscode from "vscode";
import { parseHarness, type Harness } from "../../parser/index.js";
import { HarnessTreeProvider } from "./harnessTreeProvider.js";

const REFRESH_DEBOUNCE_MS = 250;

export interface SidebarHandle {
  provider: HarnessTreeProvider;
  refresh(): void;
}

export function registerSidebar(context: vscode.ExtensionContext): SidebarHandle {
  const provider = new HarnessTreeProvider();
  const treeView = vscode.window.createTreeView("yggdrasil.harness", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const refresher = new DebouncedRefresher(provider, REFRESH_DEBOUNCE_MS);
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
      if (!this.disposed) this.provider.setHarness(harness);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Yggdrasil: failed to parse harness: ${(err as Error).message}`,
      );
      if (!this.disposed) this.provider.setHarness(null);
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
