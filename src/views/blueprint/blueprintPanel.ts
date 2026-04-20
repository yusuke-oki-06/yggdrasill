import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { buildGraph, type GraphElements } from "../../graph/elements.js";
import type { Harness } from "../../parser/types.js";

interface WebViewMessage {
  type: "openFile" | "ready";
  path?: string;
}

export class BlueprintPanel {
  private static current: BlueprintPanel | null = null;

  static currentPanel(): BlueprintPanel | null {
    return BlueprintPanel.current;
  }

  static show(context: vscode.ExtensionContext, harness: Harness | null): BlueprintPanel {
    if (BlueprintPanel.current) {
      BlueprintPanel.current.panel.reveal(vscode.ViewColumn.Active);
      if (harness) BlueprintPanel.current.update(harness);
      return BlueprintPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      "yggdrasil.blueprint",
      "Yggdrasil Blueprint",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
          vscode.Uri.joinPath(context.extensionUri, "node_modules", "cytoscape", "dist"),
          vscode.Uri.joinPath(context.extensionUri, "node_modules", "cytoscape-fcose"),
        ],
      },
    );
    BlueprintPanel.current = new BlueprintPanel(context, panel, harness);
    return BlueprintPanel.current;
  }

  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private pendingElements: GraphElements | null = null;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly panel: vscode.WebviewPanel,
    harness: Harness | null,
  ) {
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg: WebViewMessage) => this.handleMessage(msg),
      null,
      this.disposables,
    );
    void this.renderShell().then(() => {
      if (harness) this.update(harness);
    });
  }

  update(harness: Harness): void {
    const elements = buildGraph(harness);
    this.pendingElements = elements;
    if (this.ready) {
      void this.panel.webview.postMessage({ type: "update", elements });
    }
  }

  private async renderShell(): Promise<void> {
    const webview = this.panel.webview;
    const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, "media");
    const cytoscapeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "node_modules",
        "cytoscape",
        "dist",
        "cytoscape.min.js",
      ),
    );
    const fcoseUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "node_modules",
        "cytoscape-fcose",
        "cytoscape-fcose.js",
      ),
    );
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "graph.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "graph.css"));

    const htmlPath = path.join(this.context.extensionPath, "media", "graph.html");
    const raw = await fs.readFile(htmlPath, "utf8");
    const nonce = randomNonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    this.panel.webview.html = raw
      .replaceAll("{{CSP}}", csp)
      .replaceAll("{{NONCE}}", nonce)
      .replaceAll("{{CYTOSCAPE_URI}}", cytoscapeUri.toString())
      .replaceAll("{{FCOSE_URI}}", fcoseUri.toString())
      .replaceAll("{{SCRIPT_URI}}", scriptUri.toString())
      .replaceAll("{{STYLE_URI}}", styleUri.toString());
  }

  private handleMessage(msg: WebViewMessage): void {
    if (msg.type === "ready") {
      this.ready = true;
      if (this.pendingElements) {
        void this.panel.webview.postMessage({ type: "update", elements: this.pendingElements });
      }
    } else if (msg.type === "openFile" && msg.path) {
      void vscode.window.showTextDocument(vscode.Uri.file(msg.path));
    }
  }

  private dispose(): void {
    BlueprintPanel.current = null;
    while (this.disposables.length) {
      const d = this.disposables.pop();
      try {
        d?.dispose();
      } catch {
        // ignore
      }
    }
    try {
      this.panel.dispose();
    } catch {
      // ignore
    }
  }
}

function randomNonce(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 24; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
