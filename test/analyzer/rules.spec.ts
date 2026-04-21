import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeHarness } from "../../src/analyzer/index.js";
import { duplicateSkillName } from "../../src/analyzer/rules/duplicateSkillName.js";
import { hookEmptyCommand } from "../../src/analyzer/rules/hookEmptyCommand.js";
import { mcpMissingEnv } from "../../src/analyzer/rules/mcpMissingEnv.js";
import { missingSkillDescription } from "../../src/analyzer/rules/missingSkillDescription.js";
import { pluginMissingInstall } from "../../src/analyzer/rules/pluginMissingInstall.js";
import { emptyHarness, type Harness } from "../../src/parser/types.js";

function makeHarness(patch: Partial<Harness> = {}): Harness {
  return { ...emptyHarness("/ws"), ...patch };
}

describe("duplicateSkillName", () => {
  it("flags every skill that shares a name", () => {
    const harness = makeHarness({
      skills: [
        {
          id: "a",
          name: "dup",
          description: "x",
          source: "project",
          path: "/ws/.claude/skills/a/SKILL.md",
        },
        {
          id: "b",
          name: "dup",
          description: "y",
          source: "user",
          path: "/home/.claude/skills/b/SKILL.md",
        },
        {
          id: "c",
          name: "unique",
          description: "z",
          source: "project",
          path: "/ws/.claude/skills/c/SKILL.md",
        },
      ],
    });
    const found = duplicateSkillName(harness);
    expect(found).toHaveLength(2);
    expect(found.every((f) => f.rule === "skill.duplicate-name")).toBe(true);
    expect(found.map((f) => f.targetId).sort()).toEqual(["skill::a", "skill::b"]);
  });

  it("returns nothing when all names are unique", () => {
    const harness = makeHarness({
      skills: [
        {
          id: "a",
          name: "one",
          description: "x",
          source: "project",
          path: "/ws/.claude/skills/a/SKILL.md",
        },
      ],
    });
    expect(duplicateSkillName(harness)).toEqual([]);
  });
});

describe("missingSkillDescription", () => {
  it("flags empty and whitespace-only descriptions", () => {
    const harness = makeHarness({
      skills: [
        {
          id: "empty",
          name: "empty",
          description: "",
          source: "project",
          path: "/ws/.claude/skills/empty/SKILL.md",
        },
        {
          id: "blank",
          name: "blank",
          description: "   ",
          source: "project",
          path: "/ws/.claude/skills/blank/SKILL.md",
        },
        {
          id: "ok",
          name: "ok",
          description: "Does a thing",
          source: "project",
          path: "/ws/.claude/skills/ok/SKILL.md",
        },
      ],
    });
    const found = missingSkillDescription(harness);
    expect(found.map((f) => f.targetId).sort()).toEqual(["skill::blank", "skill::empty"]);
  });
});

describe("mcpMissingEnv", () => {
  it("flags refs that are not set in harness.env or shell env", () => {
    const harness = makeHarness({
      env: { RESOLVED_FROM_SETTINGS: "value" },
      mcpServers: [
        {
          id: "github",
          name: "github",
          type: "stdio",
          envKeys: [
            "GITHUB_PERSONAL_ACCESS_TOKEN",
            "GITHUB_PAT",
            "RESOLVED_FROM_SETTINGS",
            "FROM_SHELL",
          ],
          envRefs: ["GITHUB_PAT", "RESOLVED_FROM_SETTINGS", "FROM_SHELL"],
          source: "project",
          path: "/ws/.mcp.json",
        },
      ],
    });
    const found = mcpMissingEnv(harness, { shellEnv: { FROM_SHELL: "yep" } });
    expect(found).toHaveLength(1);
    expect(found[0].targetId).toBe("mcp::github");
    expect(found[0].message).toContain("GITHUB_PAT");
  });

  it("does not flag declared envKeys that are not placeholder refs", () => {
    const harness = makeHarness({
      mcpServers: [
        {
          id: "self-contained",
          name: "self-contained",
          type: "stdio",
          envKeys: ["DECLARED_ONLY"],
          envRefs: [],
          source: "project",
          path: "/ws/.mcp.json",
        },
      ],
    });
    expect(mcpMissingEnv(harness, { shellEnv: {} })).toEqual([]);
  });
});

describe("hookEmptyCommand", () => {
  it("flags hooks with empty command", () => {
    const harness = makeHarness({
      hooks: [
        {
          id: "bad",
          event: "PreToolUse",
          matcher: "Bash",
          command: "",
          source: "project",
          path: "/ws/.claude/settings.json",
        },
        {
          id: "good",
          event: "PreToolUse",
          matcher: "Bash",
          command: "echo ok",
          source: "project",
          path: "/ws/.claude/settings.json",
        },
      ],
    });
    const found = hookEmptyCommand(harness);
    expect(found).toHaveLength(1);
    expect(found[0].targetId).toBe("hook::bad");
  });
});

describe("pluginMissingInstall", () => {
  let pluginsRoot: string;

  beforeEach(async () => {
    pluginsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "yggdrasill-plugins-"));
  });

  afterEach(async () => {
    await fs.rm(pluginsRoot, { recursive: true, force: true });
  });

  it("flags enabled plugins that are not present on disk", async () => {
    await fs.mkdir(path.join(pluginsRoot, "claude-plugins-official", "playwright"), {
      recursive: true,
    });
    const harness = makeHarness({
      plugins: [
        {
          id: "playwright@claude-plugins-official::project",
          name: "playwright@claude-plugins-official",
          enabled: true,
          source: "project",
        },
        {
          id: "missing-thing@some-namespace::project",
          name: "missing-thing@some-namespace",
          enabled: true,
          source: "project",
        },
        {
          id: "disabled@some-namespace::project",
          name: "disabled@some-namespace",
          enabled: false,
          source: "project",
        },
      ],
    });
    const found = await pluginMissingInstall(harness, { pluginsRoot });
    expect(found).toHaveLength(1);
    expect(found[0].rule).toBe("plugin.missing-install");
    expect(found[0].message).toContain("missing-thing@some-namespace");
  });

  it("ignores plugin entries without a namespace", async () => {
    const harness = makeHarness({
      plugins: [
        {
          id: "no-namespace::project",
          name: "no-namespace",
          enabled: true,
          source: "project",
        },
      ],
    });
    expect(await pluginMissingInstall(harness, { pluginsRoot })).toEqual([]);
  });
});

describe("analyzeHarness", () => {
  it("aggregates all rules", async () => {
    const harness = makeHarness({
      env: {},
      skills: [
        {
          id: "dup1",
          name: "dup",
          description: "",
          source: "project",
          path: "/ws/.claude/skills/dup1/SKILL.md",
        },
        {
          id: "dup2",
          name: "dup",
          description: "Has description",
          source: "user",
          path: "/home/.claude/skills/dup2/SKILL.md",
        },
      ],
      mcpServers: [
        {
          id: "m",
          name: "m",
          type: "stdio",
          envKeys: ["TOKEN"],
          envRefs: ["TOKEN"],
          source: "project",
          path: "/ws/.mcp.json",
        },
      ],
      hooks: [
        {
          id: "h",
          event: "PreToolUse",
          command: "",
          source: "project",
          path: "/ws/.claude/settings.json",
        },
      ],
    });
    const found = await analyzeHarness(harness, { shellEnv: {} });
    const rules = new Set(found.map((f) => f.rule));
    expect(rules).toContain("skill.duplicate-name");
    expect(rules).toContain("skill.missing-description");
    expect(rules).toContain("mcp.missing-env");
    expect(rules).toContain("hook.empty-command");
  });

  it("returns empty for a clean harness", async () => {
    expect(await analyzeHarness(makeHarness(), { shellEnv: {} })).toEqual([]);
  });
});
