import * as path from "node:path";
import type { ClaudeMdDoc, Source } from "./types.js";
import { exists, id, userClaudeDir } from "./util.js";

export interface ParsedClaudeMd {
  docs: ClaudeMdDoc[];
}

export async function parseClaudeMd(workspace: string): Promise<ParsedClaudeMd> {
  const candidates: Array<{ abs: string; kind: "CLAUDE.md" | "AGENTS.md"; source: Source }> = [
    { abs: path.join(userClaudeDir(), "CLAUDE.md"), kind: "CLAUDE.md", source: "user" },
    { abs: path.join(workspace, "CLAUDE.md"), kind: "CLAUDE.md", source: "project" },
    { abs: path.join(workspace, "AGENTS.md"), kind: "AGENTS.md", source: "project" },
  ];

  const docs: ClaudeMdDoc[] = [];
  for (const c of candidates) {
    if (!(await exists(c.abs))) continue;
    docs.push({
      id: id(c.kind, c.source, c.abs),
      path: c.abs,
      kind: c.kind,
      source: c.source,
    });
  }
  return { docs };
}
