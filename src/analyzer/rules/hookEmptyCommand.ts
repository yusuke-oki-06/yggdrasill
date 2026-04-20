import type { Harness } from "../../parser/types.js";
import type { Inconsistency } from "../types.js";

export function hookEmptyCommand(harness: Harness): Inconsistency[] {
  const out: Inconsistency[] = [];
  for (const hook of harness.hooks) {
    if (hook.command.trim().length > 0) continue;
    const label = hook.matcher ? `${hook.event} (${hook.matcher})` : hook.event;
    out.push({
      id: `hook.empty-command::${hook.id}`,
      rule: "hook.empty-command",
      severity: "warning",
      message: `Hook ${label} has no command to run.`,
      path: hook.path,
      targetId: `hook::${hook.id}`,
    });
  }
  return out;
}
