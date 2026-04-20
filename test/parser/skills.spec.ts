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
  });
});
