import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { Inconsistency } from "../../analyzer/types.js";
import { buildGraph, type GraphElements } from "../../graph/elements.js";
import type { Harness } from "../../parser/types.js";

interface WebViewMessage {
  type: "openFile" | "ready" | "setIncludePluginSkills";
  path?: string;
  value?: boolean;
}

interface UpdatePayload {
  type: "update";
  elements: GraphElements;
  issueTargets: string[];
}

export class BlueprintPanel {
  private static current: BlueprintPanel | null = null;

  static currentPanel(): BlueprintPanel | null {
    return BlueprintPanel.current;
  }

  static show(
    context: vscode.ExtensionContext,
    harness: Harness | null,
    inconsistencies: Inconsistency[] = [],
  ): BlueprintPanel {
    if (BlueprintPanel.current) {
      BlueprintPanel.current.panel.reveal(vscode.ViewColumn.Active);
      if (harness) BlueprintPanel.current.update(harness, inconsistencies);
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
    BlueprintPanel.current = new BlueprintPanel(context, panel, harness, inconsistencies);
    return BlueprintPanel.current;
  }

  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private pending: UpdatePayload | null = null;
  private latestHarness: Harness | null = null;
  private latestInconsistencies: Inconsistency[] = [];
  private includePluginSkills = false;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly panel: vscode.WebviewPanel,
    harness: Harness | null,
    inconsistencies: Inconsistency[],
  ) {
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg: WebViewMessage) => this.handleMessage(msg),
      null,
      this.disposables,
    );
    void this.renderShell().then(() => {
      if (harness) this.update(harness, inconsistencies);
    });
  }

  update(harness: Harness, inconsistencies: Inconsistency[] = []): void {
    this.latestHarness = harness;
    this.latestInconsistencies = inconsistencies;
    this.render();
  }

  private render(): void {
    if (!this.latestHarness) return;
    const elements = buildGraph(this.latestHarness, {
      includePluginSkills: this.includePluginSkills,
    });
    const issueTargets = [
      ...new Set(
        this.latestInconsistencies
          .map((inc) => inc.targetId)
          .filter((t): t is string => typeof t === "string" && t.length > 0),
      ),
    ];
    const payload: UpdatePayload = { type: "update", elements, issueTargets };
    this.pending = payload;
    if (this.ready) {
      void this.panel.webview.postMessage(payload);
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
      if (this.pending) {
        void this.panel.webview.postMessage(this.pending);
      }
    } else if (msg.type === "openFile" && msg.path) {
      void vscode.window.showTextDocument(vscode.Uri.file(msg.path));
    } else if (msg.type === "setIncludePluginSkills") {
      this.includePluginSkills = Boolean(msg.value);
      this.render();
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
