import { promises as fs } from "node:fs";

const TAIL_BYTES = 16 * 1024;
const KEYWORDS: readonly string[] = ["AskUserQuestion", "ExitPlanMode", "permission_request"];

export type InputRequiredKind = "AskUserQuestion" | "ExitPlanMode" | "permission_request";

export function projectSlug(workspaceAbs: string): string {
  return workspaceAbs.replace(/[\\/:]/g, "-").replace(/^-+/, "");
}

export function detectInputRequired(line: string): InputRequiredKind | null {
  if (!KEYWORDS.some((k) => line.includes(k))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  if (obj.type === "permission_request") return "permission_request";

  if (obj.type !== "assistant") return null;
  const message = obj.message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) return null;

  for (const item of content) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    if (c.type !== "tool_use") continue;
    if (c.name === "AskUserQuestion") return "AskUserQuestion";
    if (c.name === "ExitPlanMode") return "ExitPlanMode";
  }
  return null;
}

export async function readTail(filePath: string, maxBytes = TAIL_BYTES): Promise<string[]> {
  const stat = await fs.stat(filePath);
  if (stat.size === 0) return [];
  const start = Math.max(0, stat.size - maxBytes);
  const fd = await fs.open(filePath, "r");
  try {
    const length = stat.size - start;
    const buf = Buffer.alloc(length);
    await fd.read(buf, 0, length, start);
    const text = buf.toString("utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    if (start > 0 && lines.length > 0) lines.shift();
    return lines;
  } finally {
    await fd.close();
  }
}
