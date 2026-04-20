import { parseClaudeMd } from "./claudeMd.js";
import { parseMcp } from "./mcp.js";
import { parseMemory } from "./memory.js";
import { parseRules } from "./rules.js";
import { parseSettings } from "./settings.js";
import { parseSkills } from "./skills.js";
import { Harness, emptyHarness } from "./types.js";

export interface ParseOptions {
  memoryRoot?: string;
}

export async function parseHarness(
  workspace: string,
  options: ParseOptions = {},
): Promise<Harness> {
  const harness = emptyHarness(workspace);

  const [settings, skills, mcp, memory, rules, claudeMd] = await Promise.all([
    parseSettings(workspace),
    parseSkills(workspace),
    parseMcp(workspace),
    parseMemory(workspace, options.memoryRoot),
    parseRules(workspace),
    parseClaudeMd(workspace),
  ]);

  harness.env = settings.env;
  harness.plugins = settings.plugins;
  harness.permissions = settings.permissions;
  harness.hooks = settings.hooks;
  harness.skills = skills.skills;
  harness.mcpServers = mcp.mcpServers;
  harness.memory = memory.memory;
  harness.rules = rules.rules;
  harness.claudeMd = claudeMd.docs;

  harness.issues = [
    ...settings.issues,
    ...skills.issues,
    ...mcp.issues,
    ...memory.issues,
  ];

  return Harness.parse(harness);
}

export * from "./types.js";
