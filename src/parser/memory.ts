import matter from "gray-matter";
import * as path from "node:path";
import type { MemoryEntry, ParseIssue } from "./types.js";
import { exists, id, listFiles, readText, userMemoryDir } from "./util.js";

export interface ParsedMemory {
  memory: MemoryEntry[];
  memoryRoot: string | null;
  issues: ParseIssue[];
}

export async function parseMemory(
  workspace: string,
  overrideRoot?: string,
): Promise<ParsedMemory> {
  const memoryRoot = overrideRoot ?? userMemoryDir(workspace);
  const memory: MemoryEntry[] = [];
  const issues: ParseIssue[] = [];

  if (!(await exists(memoryRoot))) {
    return { memory, memoryRoot: null, issues };
  }

  const files = await listFiles(memoryRoot, ".md");
  for (const name of files) {
    if (name === "MEMORY.md") continue;
    const abs = path.join(memoryRoot, name);
    const text = await readText(abs);
    if (!text) continue;
    try {
      const parsed = matter(text);
      const data = parsed.data as Record<string, unknown>;
      const entryName =
        typeof data.name === "string" ? data.name : path.basename(name, ".md");
      const description = typeof data.description === "string" ? data.description : undefined;
      const type = typeof data.type === "string" ? data.type : undefined;
      memory.push({
        id: id(entryName, abs),
        name: entryName,
        description,
        type,
        path: abs,
        source: "project",
      });
    } catch (err) {
      issues.push({
        severity: "warning",
        message: `Failed to parse memory frontmatter: ${(err as Error).message}`,
        path: abs,
      });
    }
  }

  return { memory, memoryRoot, issues };
}
