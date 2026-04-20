import { z } from "zod";

export const Source = z.enum(["project", "local", "user", "plugin"]);
export type Source = z.infer<typeof Source>;

export const HookEvent = z.enum([
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "SessionStart",
  "Notification",
  "Stop",
  "SubagentStop",
]);
export type HookEvent = z.infer<typeof HookEvent>;

export const Skill = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  source: Source,
  path: z.string(),
  license: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type Skill = z.infer<typeof Skill>;

export const Hook = z.object({
  id: z.string(),
  event: HookEvent,
  matcher: z.string().optional(),
  command: z.string(),
  source: Source,
  path: z.string(),
});
export type Hook = z.infer<typeof Hook>;

export const MCPServer = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["stdio", "http", "sse"]).default("stdio"),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  envKeys: z.array(z.string()).default([]),
  url: z.string().optional(),
  source: Source,
  path: z.string(),
});
export type MCPServer = z.infer<typeof MCPServer>;

export const MemoryEntry = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.string().optional(),
  path: z.string(),
  source: Source,
});
export type MemoryEntry = z.infer<typeof MemoryEntry>;

export const Plugin = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  source: Source,
});
export type Plugin = z.infer<typeof Plugin>;

export const Permission = z.object({
  id: z.string(),
  mode: z.enum(["allow", "deny"]),
  pattern: z.string(),
  source: Source,
});
export type Permission = z.infer<typeof Permission>;

export const ClaudeMdDoc = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["CLAUDE.md", "AGENTS.md"]),
  source: Source,
});
export type ClaudeMdDoc = z.infer<typeof ClaudeMdDoc>;

export const RuleDoc = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  source: Source,
});
export type RuleDoc = z.infer<typeof RuleDoc>;

export const ParseIssue = z.object({
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  path: z.string().optional(),
});
export type ParseIssue = z.infer<typeof ParseIssue>;

export const Harness = z.object({
  workspace: z.string(),
  skills: z.array(Skill),
  hooks: z.array(Hook),
  mcpServers: z.array(MCPServer),
  memory: z.array(MemoryEntry),
  plugins: z.array(Plugin),
  permissions: z.array(Permission),
  claudeMd: z.array(ClaudeMdDoc),
  rules: z.array(RuleDoc),
  env: z.record(z.string()),
  issues: z.array(ParseIssue),
});
export type Harness = z.infer<typeof Harness>;

export function emptyHarness(workspace: string): Harness {
  return {
    workspace,
    skills: [],
    hooks: [],
    mcpServers: [],
    memory: [],
    plugins: [],
    permissions: [],
    claudeMd: [],
    rules: [],
    env: {},
    issues: [],
  };
}
