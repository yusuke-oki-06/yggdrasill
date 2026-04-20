import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseSettings } from "../../src/parser/settings.js";
import { makeFixture } from "./fixtures.js";

describe("parseSettings", () => {
  let fx: Awaited<ReturnType<typeof makeFixture>>;

  beforeEach(async () => {
    fx = await makeFixture();
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  it("reads env, plugins, permissions, and known hooks", async () => {
    const parsed = await parseSettings(fx.root);

    expect(parsed.env.FEATURE_FLAG).toBe("on");

    expect(parsed.plugins.map((p) => p.name)).toContain("playwright@claude-plugins-official");

    const modes = parsed.permissions.map((p) => `${p.mode}:${p.pattern}`);
    expect(modes).toContain("allow:Bash(npm test)");
    expect(modes).toContain("deny:Bash(rm -rf *)");

    expect(parsed.hooks).toHaveLength(1);
    expect(parsed.hooks[0]).toMatchObject({
      event: "PreToolUse",
      matcher: "Bash",
      command: "echo pre-bash",
    });
  });

  it("records an issue for unknown hook events", async () => {
    const parsed = await parseSettings(fx.root);
    const warnings = parsed.issues.filter((i) => i.severity === "warning");
    expect(warnings.some((w) => w.message.includes("NotARealEvent"))).toBe(true);
  });
});
