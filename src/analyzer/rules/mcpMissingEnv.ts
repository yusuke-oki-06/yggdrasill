import type { Harness } from "../../parser/types.js";
import type { Inconsistency } from "../types.js";

export interface McpMissingEnvOptions {
  shellEnv?: NodeJS.ProcessEnv;
}

export function mcpMissingEnv(
  harness: Harness,
  options: McpMissingEnvOptions = {},
): Inconsistency[] {
  const shellEnv = options.shellEnv ?? process.env;
  const out: Inconsistency[] = [];
  for (const mcp of harness.mcpServers) {
    for (const ref of mcp.envRefs) {
      if (hasValue(harness.env[ref]) || hasValue(shellEnv[ref])) continue;
      out.push({
        id: `mcp.missing-env::${mcp.id}::${ref}`,
        rule: "mcp.missing-env",
        severity: "warning",
        message: `MCP "${mcp.name}" references env var \${${ref}} but it is not set in settings.json or the shell environment.`,
        path: mcp.path,
        targetId: `mcp::${mcp.id}`,
      });
    }
  }
  return out;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.length > 0;
}
