import matter from "gray-matter";
import * as path from "node:path";
import type { ParseIssue, Skill, Source } from "./types.js";
import { exists, id, listDirs, listFiles, readText, userClaudeDir } from "./util.js";

export interface ParsedSkills {
  skills: Skill[];
  issues: ParseIssue[];
}

export async function parseSkills(workspace: string): Promise<ParsedSkills> {
  const roots: Array<{ abs: string; source: Source }> = [
    { abs: path.join(workspace, ".claude", "skills"), source: "project" },
    { abs: path.join(userClaudeDir(), "skills"), source: "user" },
  ];

  const skills: Skill[] = [];
  const issues: ParseIssue[] = [];

  for (const root of roots) {
    if (!(await exists(root.abs))) continue;
    await collectSkills(root.abs, root.source, skills, issues);
  }

  await collectPluginSkills(skills, issues);

  return { skills, issues };
}

interface SkillOrigin {
  pluginNamespace?: string;
  pluginName?: string;
}

async function collectSkills(
  root: string,
  source: Source,
  skills: Skill[],
  issues: ParseIssue[],
  origin: SkillOrigin = {},
): Promise<void> {
  const dirs = await listDirs(root);
  for (const dir of dirs) {
    const skillDir = path.join(root, dir);
    const skillMd = path.join(skillDir, "SKILL.md");
    const parsed = await parseSkillFile(skillMd, source, origin);
    if (parsed.skill) skills.push(parsed.skill);
    issues.push(...parsed.issues);
  }

  const markdowns = await listFiles(root, ".md");
  for (const md of markdowns) {
    if (md.toUpperCase() === "SKILL.MD") continue;
    const parsed = await parseSkillFile(path.join(root, md), source, origin);
    if (parsed.skill) skills.push(parsed.skill);
    issues.push(...parsed.issues);
  }
}

async function collectPluginSkills(skills: Skill[], issues: ParseIssue[]): Promise<void> {
  const pluginsRoot = path.join(userClaudeDir(), "plugins", "cache");
  if (!(await exists(pluginsRoot))) return;

  const namespaces = await listDirs(pluginsRoot);
  for (const namespace of namespaces) {
    const namespaceDir = path.join(pluginsRoot, namespace);
    const plugins = await listDirs(namespaceDir);
    for (const plugin of plugins) {
      const versions = await listDirs(path.join(namespaceDir, plugin));
      for (const version of versions) {
        const skillsDir = path.join(namespaceDir, plugin, version, "skills");
        if (!(await exists(skillsDir))) continue;
        await collectSkills(skillsDir, "plugin", skills, issues, {
          pluginNamespace: namespace,
          pluginName: plugin,
        });
      }
    }
  }
}

async function parseSkillFile(
  absPath: string,
  source: Source,
  origin: SkillOrigin = {},
): Promise<{ skill: Skill | null; issues: ParseIssue[] }> {
  const issues: ParseIssue[] = [];
  const text = await readText(absPath);
  if (!text) return { skill: null, issues };

  try {
    const parsed = matter(text);
    const data = parsed.data as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name : inferNameFromPath(absPath);
    const description = typeof data.description === "string" ? data.description : "";
    const license = typeof data.license === "string" ? data.license : undefined;
    const metadata = isRecord(data.metadata) ? data.metadata : undefined;

    if (!name) {
      issues.push({
        severity: "warning",
        message: "Skill has no name in frontmatter or filename",
        path: absPath,
      });
      return { skill: null, issues };
    }

    const skill: Skill = {
      id: id(name, source, absPath),
      name,
      description,
      license,
      metadata,
      source,
      path: absPath,
      pluginNamespace: origin.pluginNamespace,
      pluginName: origin.pluginName,
    };
    return { skill, issues };
  } catch (err) {
    issues.push({
      severity: "warning",
      message: `Failed to parse frontmatter: ${(err as Error).message}`,
      path: absPath,
    });
    return { skill: null, issues };
  }
}

function inferNameFromPath(absPath: string): string {
  const base = path.basename(absPath, path.extname(absPath));
  if (base.toUpperCase() === "SKILL") {
    return path.basename(path.dirname(absPath));
  }
  return base;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
