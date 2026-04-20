import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseHarness } from "../../src/parser/index.js";
import { makeFixture } from "./fixtures.js";

describe("parseHarness", () => {
  let fx: Awaited<ReturnType<typeof makeFixture>>;

  beforeEach(async () => {
    fx = await makeFixture();
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  it("aggregates every harness category from a fixture workspace", async () => {
    const harness = await parseHarness(fx.root, { memoryRoot: path.join(fx.root, "memory") });

    expect(harness.workspace).toBe(fx.root);

    expect(harness.skills.some((s) => s.name === "example-skill")).toBe(true);
    expect(harness.rules.some((r) => r.name === "typescript")).toBe(true);
    expect(harness.mcpServers.some((m) => m.name === "github")).toBe(true);
    expect(harness.plugins.some((p) => p.name === "playwright@claude-plugins-official")).toBe(true);
    expect(harness.claudeMd.map((d) => d.kind).sort()).toEqual(["AGENTS.md", "CLAUDE.md"]);
    expect(harness.memory.some((m) => m.name === "user-role")).toBe(true);
    expect(harness.hooks.some((h) => h.event === "PreToolUse")).toBe(true);
    expect(harness.permissions.length).toBeGreaterThanOrEqual(2);
    expect(harness.env.FEATURE_FLAG).toBe("on");
    expect(harness.issues.some((i) => i.message.includes("NotARealEvent"))).toBe(true);
  });
});
