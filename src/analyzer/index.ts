import type { Harness } from "../parser/types.js";
import { duplicateSkillName } from "./rules/duplicateSkillName.js";
import { hookEmptyCommand } from "./rules/hookEmptyCommand.js";
import { mcpMissingEnv, type McpMissingEnvOptions } from "./rules/mcpMissingEnv.js";
import { missingSkillDescription } from "./rules/missingSkillDescription.js";
import type { Inconsistency } from "./types.js";

export interface AnalyzeOptions extends McpMissingEnvOptions {}

export function analyzeHarness(
  harness: Harness,
  options: AnalyzeOptions = {},
): Inconsistency[] {
  return [
    ...duplicateSkillName(harness),
    ...missingSkillDescription(harness),
    ...mcpMissingEnv(harness, options),
    ...hookEmptyCommand(harness),
  ];
}

export * from "./types.js";
