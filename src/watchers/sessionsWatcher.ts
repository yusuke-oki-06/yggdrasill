import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { userClaudeDir } from "../parser/util.js";
import {
  detectInputRequired,
  projectSlug,
  readTail,
  type InputRequiredKind,
} from "./sessionsParser.js";

const RESCAN_LINES = 5;

export interface SessionsWatcherOptions {
  workspace: string;
  show?: (kind: InputRequiredKind, sessionId: string, filePath: string) => void;
  isEnabled?: () => boolean;
}

export class SessionsWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly notifiedSize = new Map<string, number>();
  private readonly show: NonNullable<SessionsWatcherOptions["show"]>;
  private readonly isEnabled: NonNullable<SessionsWatcherOptions["isEnabled"]>;

  constructor(options: SessionsWatcherOptions) {
    this.show = options.show ?? defaultShow;
    this.isEnabled = options.isEnabled ?? defaultIsEnabled;

    const slug = projectSlug(options.workspace);
    const dir = path.join(userClaudeDir(), "projects", slug);
    const pattern = new vscode.RelativePattern(vscode.Uri.file(dir), "*.jsonl");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.disposables.push(
      watcher,
      watcher.onDidChange((uri) => void this.onChange(uri.fsPath)),
      watcher.onDidCreate((uri) => void this.onChange(uri.fsPath)),
      watcher.onDidDelete((uri) => this.notifiedSize.delete(uri.fsPath)),
    );
  }

  private async onChange(filePath: string): Promise<void> {
    if (!this.isEnabled()) return;

    let size = 0;
    try {
      const stat = await fs.stat(filePath);
      size = stat.size;
    } catch {
      return;
    }
    const lastSize = this.notifiedSize.get(filePath) ?? 0;
    if (size <= lastSize) return;

    let lines: string[];
    try {
      lines = await readTail(filePath);
    } catch {
      this.notifiedSize.set(filePath, size);
      return;
    }

    const tail = lines.slice(-RESCAN_LINES);
    for (let i = tail.length - 1; i >= 0; i--) {
      const kind = detectInputRequired(tail[i]);
      if (kind) {
        this.notifiedSize.set(filePath, size);
        const sessionId = path.basename(filePath, ".jsonl");
        this.show(kind, sessionId, filePath);
        return;
      }
    }
    this.notifiedSize.set(filePath, size);
  }

  dispose(): void {
    while (this.disposables.length) {
      const d = this.disposables.pop();
      try {
        d?.dispose();
      } catch {
        // ignore
      }
    }
  }
}

function defaultShow(kind: InputRequiredKind, sessionId: string, filePath: string): void {
  void vscode.window
    .showInformationMessage(
      `Yggdrasill: Claude Code is waiting for input — ${labelFor(kind)} (session ${sessionId.slice(0, 8)})`,
      "Open Transcript",
    )
    .then((action) => {
      if (action === "Open Transcript") {
        void vscode.window.showTextDocument(vscode.Uri.file(filePath));
      }
    });
}

function defaultIsEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("yggdrasill")
    .get<boolean>("notifications.enabled", true);
}

function labelFor(kind: InputRequiredKind): string {
  switch (kind) {
    case "AskUserQuestion":
      return "AskUserQuestion";
    case "ExitPlanMode":
      return "ExitPlanMode";
    case "permission_request":
      return "Permission Request";
  }
}
