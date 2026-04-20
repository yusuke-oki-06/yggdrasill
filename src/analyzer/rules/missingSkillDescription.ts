import type { Harness } from "../../parser/types.js";
import type { Inconsistency } from "../types.js";

export function missingSkillDescription(harness: Harness): Inconsistency[] {
  const out: Inconsistency[] = [];
  for (const skill of harness.skills) {
    if (skill.description.trim().length > 0) continue;
    out.push({
      id: `skill.missing-description::${skill.id}`,
      rule: "skill.missing-description",
      severity: "warning",
      message: `Skill "${skill.name}" has no description in frontmatter.`,
      path: skill.path,
      targetId: `skill::${skill.id}`,
    });
  }
  return out;
}
