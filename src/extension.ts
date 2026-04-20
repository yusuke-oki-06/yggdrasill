import * as vscode from "vscode";
import { BlueprintPanel } from "./views/blueprint/blueprintPanel.js";
import { registerSidebar } from "./views/sidebar/index.js";

export function activate(context: vscode.ExtensionContext): void {
  const sidebar = registerSidebar(context);

  sidebar.provider.onDidChangeHarness((harness) => {
    if (harness) {
      BlueprintPanel.currentPanel()?.update(harness);
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("yggdrasil.hello", () => {
      vscode.window.showInformationMessage("Yggdrasil: 世界樹が目覚めた 🌳");
    }),
    vscode.commands.registerCommand("yggdrasil.openBlueprint", () => {
      const harness = sidebar.provider.getHarness();
      BlueprintPanel.show(context, harness);
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
