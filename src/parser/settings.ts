import * as path from "node:path";
import type { Hook, ParseIssue, Permission, Plugin, Source } from "./types.js";
import { HookEvent } from "./types.js";
import { exists, id, readJson, userClaudeDir } from "./util.js";

interface SettingsFile {
  env?: Record<string, string>;
  enabledPlugins?: Record<string, boolean>;
  permissions?: { allow?: string[]; deny?: string[] };
  hooks?: Partial<Record<string, HookEntry[]>>;
}

interface HookEntry {
  matcher?: string;
  hooks: Array<{ type?: string; command?: string }>;
}

export interface ParsedSettings {
  env: Record<string, string>;
  plugins: Plugin[];
  permissions: Permission[];
  hooks: Hook[];
  issues: ParseIssue[];
}

const EMPTY: ParsedSettings = {
  env: {},
  plugins: [],
  permissions: [],
  hooks: [],
  issues: [],
};

export async function parseSettings(workspace: string): Promise<ParsedSettings> {
  const candidates: Array<{ abs: string; source: Source }> = [
    { abs: path.join(userClaudeDir(), "settings.json"), source: "user" },
    { abs: path.join(workspace, ".claude", "settings.json"), source: "project" },
    { abs: path.join(workspace, ".claude", "settings.local.json"), source: "local" },
  ];

  let merged: ParsedSettings = { ...EMPTY, env: {} };

  for (const c of candidates) {
    if (!(await exists(c.abs))) continue;
    const data = await readJson<SettingsFile>(c.abs);
    if (!data) {
      merged.issues.push({
        severity: "warning",
        message: `Failed to parse ${c.abs}`,
        path: c.abs,
      });
      continue;
    }
    merged = mergeSettings(merged, data, c.abs, c.source);
  }

  return merged;
}

function mergeSettings(
  acc: ParsedSettings,
  file: SettingsFile,
  absPath: string,
  source: Source,
): ParsedSettings {
  const env = { ...acc.env, ...(file.env ?? {}) };

  const plugins: Plugin[] = [...acc.plugins];
  for (const [name, enabled] of Object.entries(file.enabledPlugins ?? {})) {
    plugins.push({
      id: id(name, source),
      name,
      enabled: Boolean(enabled),
      source,
    });
  }

  const permissions: Permission[] = [...acc.permissions];
  for (const allow of file.permissions?.allow ?? []) {
    permissions.push({
      id: id("allow", allow, source),
      mode: "allow",
      pattern: allow,
      source,
    });
  }
  for (const deny of file.permissions?.deny ?? []) {
    permissions.push({
      id: id("deny", deny, source),
      mode: "deny",
      pattern: deny,
      source,
    });
  }

  const hooks: Hook[] = [...acc.hooks];
  const issues: ParseIssue[] = [...acc.issues];

  for (const [eventName, entries] of Object.entries(file.hooks ?? {})) {
    const eventResult = HookEvent.safeParse(eventName);
    if (!eventResult.success) {
      issues.push({
        severity: "warning",
        message: `Unknown hook event "${eventName}"`,
        path: absPath,
      });
      continue;
    }
    for (const entry of entries ?? []) {
      for (const h of entry.hooks ?? []) {
        if (!h.command) continue;
        hooks.push({
          id: id(eventResult.data, entry.matcher ?? "*", h.command, source),
          event: eventResult.data,
          matcher: entry.matcher,
          command: h.command,
          source,
          path: absPath,
        });
      }
    }
  }

  return { env, plugins, permissions, hooks, issues };
}
