import { promises as fs } from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseSkills } from "../../src/parser/skills.js";
import { makeFixture } from "./fixtures.js";

describe("parseSkills", () => {
  let fx: Awaited<ReturnType<typeof makeFixture>>;

  beforeEach(async () => {
    fx = await makeFixture();
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  it("parses project skills with frontmatter", async () => {
    const { skills } = await parseSkills(fx.root);
    const example = skills.find((s) => s.name === "example-skill" && s.source === "project");
    expect(example).toBeDefined();
    expect(example?.description).toContain("example skill");
    expect(example?.license).toBe("MIT");
    expect(example?.metadata?.version).toBe("0.0.1");
    expect(example?.pluginNamespace).toBeUndefined();
    expect(example?.pluginName).toBeUndefined();
  });

  it("extracts tools from frontmatter and mcpRefs from body", async () => {
    const { skills } = await parseSkills(fx.root);
    const tools = skills.find((s) => s.name === "tools-skill" && s.source === "project");
    expect(tools).toBeDefined();
    expect(tools?.tools).toEqual(
      expect.arrayContaining(["Read", "Write", "Bash", "mcp__github__create_issue"]),
    );
    expect(tools?.mcpRefs).toEqual(expect.arrayContaining(["github", "notion"]));
  });

  it("records pluginNamespace and pluginName for cached plugin skills", async () => {
    const userClaude = process.env.YGGDRASIL_USER_CLAUDE_DIR!;
    const pluginDir = path.join(userClaude, "plugins", "cache", "acme", "demo-plugin", "1.0.0");
    const skillDir = path.join(pluginDir, "skills", "demo-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: demo-skill
description: A plugin-provided skill
---

Body.
`,
    );

    try {
      const { skills } = await parseSkills(fx.root);
      const demo = skills.find((s) => s.source === "plugin" && s.name === "demo-skill");
      expect(demo).toBeDefined();
      expect(demo?.pluginNamespace).toBe("acme");
      expect(demo?.pluginName).toBe("demo-plugin");
    } finally {
      await fs.rm(path.join(userClaude, "plugins"), { recursive: true, force: true });
    }
  });
});
