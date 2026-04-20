import * as path from "node:path";
import type { MCPServer, ParseIssue, Source } from "./types.js";
import { exists, extractEnvVarKeys, id, readJson, userClaudeDir } from "./util.js";

interface McpConfig {
  mcpServers?: Record<string, RawServer>;
}

interface RawServer {
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface ParsedMcp {
  mcpServers: MCPServer[];
  issues: ParseIssue[];
}

const SERVER_TYPES = new Set(["stdio", "http", "sse"]);

export async function parseMcp(workspace: string): Promise<ParsedMcp> {
  const candidates: Array<{ abs: string; source: Source }> = [
    { abs: path.join(userClaudeDir(), ".mcp.json"), source: "user" },
    { abs: path.join(workspace, ".mcp.json"), source: "project" },
    { abs: path.join(workspace, ".claude", ".mcp.json"), source: "project" },
  ];

  const mcpServers: MCPServer[] = [];
  const issues: ParseIssue[] = [];

  for (const c of candidates) {
    if (!(await exists(c.abs))) continue;
    const data = await readJson<McpConfig>(c.abs);
    if (!data) {
      issues.push({
        severity: "warning",
        message: `Failed to parse ${c.abs}`,
        path: c.abs,
      });
      continue;
    }
    for (const [name, raw] of Object.entries(data.mcpServers ?? {})) {
      const type =
        raw.type && SERVER_TYPES.has(raw.type) ? (raw.type as "stdio" | "http" | "sse") : "stdio";
      const envKeys = new Set<string>();
      const envRefs = new Set<string>();
      for (const [k, v] of Object.entries(raw.env ?? {})) {
        envKeys.add(k);
        extractEnvVarKeys(v).forEach((key) => envRefs.add(key));
      }
      extractEnvVarKeys(raw.command).forEach((key) => envRefs.add(key));
      (raw.args ?? []).forEach((a) => extractEnvVarKeys(a).forEach((key) => envRefs.add(key)));
      extractEnvVarKeys(raw.url).forEach((key) => envRefs.add(key));
      for (const ref of envRefs) envKeys.add(ref);

      mcpServers.push({
        id: id(name, c.source),
        name,
        type,
        command: raw.command,
        args: raw.args,
        url: raw.url,
        envKeys: [...envKeys],
        envRefs: [...envRefs],
        source: c.source,
        path: c.abs,
      });
    }
  }

  return { mcpServers, issues };
}
