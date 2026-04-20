import * as path from "node:path";
import type { RuleDoc, Source } from "./types.js";
import { exists, id, listFiles, userClaudeDir } from "./util.js";

export interface ParsedRules {
  rules: RuleDoc[];
}

export async function parseRules(workspace: string): Promise<ParsedRules> {
  const roots: Array<{ abs: string; source: Source }> = [
    { abs: path.join(userClaudeDir(), "rules"), source: "user" },
    { abs: path.join(workspace, ".claude", "rules"), source: "project" },
  ];

  const rules: RuleDoc[] = [];

  for (const root of roots) {
    if (!(await exists(root.abs))) continue;
    const files = await listFiles(root.abs, ".md");
    for (const name of files) {
      const abs = path.join(root.abs, name);
      rules.push({
        id: id(name, root.source, abs),
        name: path.basename(name, ".md"),
        path: abs,
        source: root.source,
      });
    }
  }

  return { rules };
}
