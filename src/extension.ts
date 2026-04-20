import * as vscode from "vscode";
import { SessionsWatcher } from "./watchers/sessionsWatcher.js";
import { BlueprintPanel } from "./views/blueprint/blueprintPanel.js";
import { registerSidebar } from "./views/sidebar/index.js";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection("yggdrasil");
  context.subscriptions.push(diagnostics);

  const sidebar = registerSidebar(context, diagnostics);

  sidebar.provider.onDidChangeHarness((harness) => {
    if (harness) {
      BlueprintPanel.currentPanel()?.update(harness, sidebar.provider.getInconsistencies());
    }
  });

  let sessionsWatcher: SessionsWatcher | null = null;
  const initSessionsWatcher = (): void => {
    sessionsWatcher?.dispose();
    sessionsWatcher = null;
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      sessionsWatcher = new SessionsWatcher({ workspace: folders[0].uri.fsPath });
    }
  };
  initSessionsWatcher();
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => initSessionsWatcher()),
    { dispose: () => sessionsWatcher?.dispose() },
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("yggdrasil.hello", () => {
      vscode.window.showInformationMessage("Yggdrasil: 世界樹が目覚めた 🌳");
    }),
    vscode.commands.registerCommand("yggdrasil.openBlueprint", () => {
      const harness = sidebar.provider.getHarness();
      BlueprintPanel.show(context, harness, sidebar.provider.getInconsistencies());
      if (!harness) sidebar.refresh();
    }),
    vscode.commands.registerCommand("yggdrasil.refresh", () => {
      sidebar.refresh();
    }),
  );
}

export function deactivate(): void {
  // no-op
}
