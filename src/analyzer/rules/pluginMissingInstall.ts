import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { Harness } from "../../parser/types.js";
import { userClaudeDir } from "../../parser/util.js";
import type { Inconsistency } from "../types.js";

export interface PluginMissingInstallOptions {
  pluginsRoot?: string;
}

export async function pluginMissingInstall(
  harness: Harness,
  options: PluginMissingInstallOptions = {},
): Promise<Inconsistency[]> {
  const root = options.pluginsRoot ?? path.join(userClaudeDir(), "plugins", "cache");
  const out: Inconsistency[] = [];
  for (const plugin of harness.plugins) {
    if (!plugin.enabled) continue;
    const parsed = parsePluginName(plugin.name);
    if (!parsed) continue;
    const dir = path.join(root, parsed.namespace, parsed.plugin);
    if (await dirExists(dir)) continue;
    out.push({
      id: `plugin.missing-install::${plugin.id}`,
      rule: "plugin.missing-install",
      severity: "warning",
      message: `Enabled plugin "${plugin.name}" is not installed at ${dir}.`,
      targetId: `plugin::${plugin.id}`,
    });
  }
  return out;
}

function parsePluginName(name: string): { plugin: string; namespace: string } | null {
  const at = name.lastIndexOf("@");
  if (at <= 0 || at === name.length - 1) return null;
  return { plugin: name.slice(0, at), namespace: name.slice(at + 1) };
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
