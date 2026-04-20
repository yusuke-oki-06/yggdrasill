import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseMemory } from "../../src/parser/memory.js";
import { makeFixture } from "./fixtures.js";

describe("parseMemory", () => {
  let fx: Awaited<ReturnType<typeof makeFixture>>;

  beforeEach(async () => {
    fx = await makeFixture();
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  it("parses memory entries from the override root", async () => {
    const { memory, memoryRoot } = await parseMemory(fx.root, path.join(fx.root, "memory"));
    expect(memoryRoot).toBe(path.join(fx.root, "memory"));
    const entry = memory.find((m) => m.name === "user-role");
    expect(entry?.type).toBe("user");
    expect(entry?.description).toBe("User is a developer");
  });

  it("returns empty when the memory root is missing", async () => {
    const { memory, memoryRoot } = await parseMemory(fx.root, path.join(fx.root, "does-not-exist"));
    expect(memory).toHaveLength(0);
    expect(memoryRoot).toBeNull();
  });
});
