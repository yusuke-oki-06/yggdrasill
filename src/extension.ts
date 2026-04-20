import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("yggdrasil.hello", () => {
      vscode.window.showInformationMessage("Yggdrasil: 世界樹が目覚めた 🌳");
    }),
    vscode.commands.registerCommand("yggdrasil.openBlueprint", () => {
      vscode.window.showInformationMessage(
        "Blueprint view is coming in Phase 2. Run `Yggdrasil: Hello` for now.",
      );
    }),
  );
}

export function deactivate(): void {
  // no-op
}
