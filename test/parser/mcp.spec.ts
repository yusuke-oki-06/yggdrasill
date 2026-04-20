import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseMcp } from "../../src/parser/mcp.js";
import { makeFixture } from "./fixtures.js";

describe("parseMcp", () => {
  let fx: Awaited<ReturnType<typeof makeFixture>>;

  beforeEach(async () => {
    fx = await makeFixture();
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  it("parses stdio and http servers with env references", async () => {
    const { mcpServers } = await parseMcp(fx.root);
    const github = mcpServers.find((m) => m.name === "github");
    const notion = mcpServers.find((m) => m.name === "notion");

    expect(github?.type).toBe("stdio");
    expect(github?.command).toBe("npx");
    expect(github?.envKeys).toContain("GITHUB_PERSONAL_ACCESS_TOKEN");
    expect(github?.envKeys).toContain("GITHUB_PAT");

    expect(notion?.type).toBe("http");
    expect(notion?.url).toBe("https://mcp.notion.com/mcp");
  });
});
