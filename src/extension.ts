import * as vscode from "vscode";
import { registerSidebar } from "./views/sidebar/index.js";

export function activate(context: vscode.ExtensionContext): void {
  const sidebar = registerSidebar(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("yggdrasil.hello", () => {
      vscode.window.showInformationMessage("Yggdrasil: 世界樹が目覚めた 🌳");
    }),
    vscode.commands.registerCommand("yggdrasil.openBlueprint", () => {
      vscode.window.showInformationMessage(
        "Blueprint WebView is coming in Phase 2. For now, explore the Harness tree in the Yggdrasil sidebar.",
      );
    }),
    vscode.commands.registerCommand("yggdrasil.refresh", () => {
      sidebar.refresh();
    }),
  );
}

export function deactivate(): void {
  // no-op
}
