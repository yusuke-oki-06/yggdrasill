import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T = unknown>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readText(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

export async function listDirs(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function listFiles(p: string, ext?: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && (!ext || e.name.endsWith(ext))).map((e) => e.name);
  } catch {
    return [];
  }
}

export function userClaudeDir(): string {
  const override = process.env.YGGDRASIL_USER_CLAUDE_DIR;
  if (override && override.length > 0) return override;
  return path.join(os.homedir(), ".claude");
}

export function userMemoryDir(workspaceAbs: string): string {
  const slug = workspaceAbs.replace(/[\\/:]/g, "-").replace(/^-+/, "");
  return path.join(userClaudeDir(), "projects", slug, "memory");
}

export function extractEnvVarKeys(input: string | undefined): string[] {
  if (!input) return [];
  const matches = Array.from(input.matchAll(/\$\{([A-Z0-9_]+)\}/g));
  return [...new Set(matches.map((m) => m[1]))];
}

export function id(...parts: string[]): string {
  return parts.filter(Boolean).join("::");
}
