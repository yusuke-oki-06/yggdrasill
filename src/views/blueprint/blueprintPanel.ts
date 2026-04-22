import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { Inconsistency } from "../../analyzer/types.js";
import { buildGraph, type GraphElements } from "../../graph/elements.js";
import type { Harness } from "../../parser/types.js";

interface WebViewMessage {
  type: "openFile" | "ready" | "setIncludePluginSkills" | "setIncludeEnv" | "setIncludePermissions";
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
      "yggdrasill.blueprint",
      "Yggdrasill Blueprint",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
          vscode.Uri.joinPath(context.extensionUri, "dist"),
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
  private includeEnv = false;
  private includePermissions = false;

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
    void this.renderShell()
      .then(() => {
        if (harness) this.update(harness, inconsistencies);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Yggdrasill Blueprint failed to load: ${message}`);
        this.panel.webview.html = fallbackErrorHtml(message);
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
      includeEnv: this.includeEnv,
      includePermissions: this.includePermissions,
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
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "blueprint.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "blueprint.css"),
    );
    const htmlPath = path.join(this.context.extensionPath, "media", "blueprint", "index.html");
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
    } else if (msg.type === "setIncludeEnv") {
      this.includeEnv = Boolean(msg.value);
      this.render();
    } else if (msg.type === "setIncludePermissions") {
      this.includePermissions = Boolean(msg.value);
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

function fallbackErrorHtml(message: string): string {
  const safe = message.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
  return `<!doctype html><html><head><meta charset="UTF-8"><title>Yggdrasill Blueprint</title></head><body style="font-family:sans-serif;padding:24px;color:#fca5a5"><h2>Blueprint failed to load</h2><pre style="white-space:pre-wrap;background:rgba(0,0,0,0.25);padding:12px;border-radius:8px">${safe}</pre><p>Please file an issue at <a href="https://github.com/yusuke-oki-06/yggdrasill/issues">github.com/yusuke-oki-06/yggdrasill/issues</a> with your VS Code version.</p></body></html>`;
}

function randomNonce(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 24; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
