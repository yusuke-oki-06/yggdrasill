import type { Harness } from "../parser/types.js";
import { duplicateSkillName } from "./rules/duplicateSkillName.js";
import { hookEmptyCommand } from "./rules/hookEmptyCommand.js";
import { mcpMissingEnv, type McpMissingEnvOptions } from "./rules/mcpMissingEnv.js";
import { missingSkillDescription } from "./rules/missingSkillDescription.js";
import {
  pluginMissingInstall,
  type PluginMissingInstallOptions,
} from "./rules/pluginMissingInstall.js";
import type { Inconsistency } from "./types.js";

export interface AnalyzeOptions extends McpMissingEnvOptions, PluginMissingInstallOptions {}

export async function analyzeHarness(
  harness: Harness,
  options: AnalyzeOptions = {},
): Promise<Inconsistency[]> {
  const groups = await Promise.all([
    Promise.resolve(duplicateSkillName(harness)),
    Promise.resolve(missingSkillDescription(harness)),
    Promise.resolve(mcpMissingEnv(harness, options)),
    Promise.resolve(hookEmptyCommand(harness)),
    pluginMissingInstall(harness, options),
  ]);
  return groups.flat();
}

export * from "./types.js";
