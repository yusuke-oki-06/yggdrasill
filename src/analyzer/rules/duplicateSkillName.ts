import type { Harness } from "../../parser/types.js";
import type { Inconsistency } from "../types.js";

export function duplicateSkillName(harness: Harness): Inconsistency[] {
  const byName = new Map<string, Harness["skills"]>();
  for (const skill of harness.skills) {
    const bucket = byName.get(skill.name) ?? [];
    bucket.push(skill);
    byName.set(skill.name, bucket);
  }

  const out: Inconsistency[] = [];
  for (const [name, skills] of byName) {
    if (skills.length < 2) continue;
    for (const skill of skills) {
      out.push({
        id: `skill.duplicate-name::${skill.id}`,
        rule: "skill.duplicate-name",
        severity: "warning",
        message: `Skill name "${name}" is defined ${skills.length} times; names should be unique.`,
        path: skill.path,
        targetId: `skill::${skill.id}`,
      });
    }
  }
  return out;
}
