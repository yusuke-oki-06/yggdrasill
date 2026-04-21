import { describe, expect, it } from "vitest";
import { buildRelationships } from "../../src/graph/relationships.js";
import { emptyHarness, type Harness } from "../../src/parser/types.js";

function makeHarness(patch: Partial<Harness> = {}): Harness {
  return { ...emptyHarness("/ws"), ...patch };
}

describe("buildRelationships", () => {
  it("emits owns edge from pluginGroup to plugin-sourced skills", () => {
    const harness = makeHarness({
      skills: [
        {
          id: "alpha",
          name: "alpha",
          description: "",
          source: "plugin",
          path: "/p/alpha/SKILL.md",
          pluginNamespace: "acme",
          pluginName: "demo",
        },
      ],
    });
    const result = buildRelationships(harness);
    const owns = result.edges.filter((e) => e.data.relation === "owns");
    expect(owns).toHaveLength(1);
    expect(owns[0].data.source).toBe("pluginGroup::acme::demo");
    expect(owns[0].data.target).toBe("skill::alpha");
    expect(owns[0].data.kind).toBe("relationship");
  });

  it("emits overrides edge between same-name skills with different sources", () => {
    const harness = makeHarness({
      skills: [
        {
          id: "p",
          name: "shared",
          description: "",
          source: "project",
          path: "/ws/.claude/skills/shared/SKILL.md",
        },
        {
          id: "u",
          name: "shared",
          description: "",
          source: "user",
          path: "/home/.claude/skills/shared/SKILL.md",
        },
      ],
    });
    const shadows = buildRelationships(harness).edges.filter(
      (e) => e.data.relation === "overrides",
    );
    expect(shadows).toHaveLength(1);
    expect(shadows[0].data.source).toBe("skill::p");
    expect(shadows[0].data.target).toBe("skill::u");
  });

  it("emits conflicts edge between same-pattern allow and deny permissions", () => {
    const harness = makeHarness({
      permissions: [
        { id: "a", mode: "allow", pattern: "Bash(rm:*)", source: "project" },
        { id: "d", mode: "deny", pattern: "Bash(rm:*)", source: "user" },
      ],
    });
    const conflicts = buildRelationships(harness).edges.filter(
      (e) => e.data.relation === "conflicts",
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].data.source).toBe("permission::a");
    expect(conflicts[0].data.target).toBe("permission::d");
  });

  it("emits requires-tool edges to tool nodes and resolves mcp__server__tool to mcp", () => {
    const harness = makeHarness({
      mcpServers: [
        {
          id: "github::project",
          name: "github",
          type: "stdio",
          envKeys: [],
          envRefs: [],
          source: "project",
          path: "/ws/.mcp.json",
        },
      ],
      skills: [
        {
          id: "s",
          name: "s",
          description: "",
          source: "project",
          path: "/ws/.claude/skills/s/SKILL.md",
          tools: ["Read", "mcp__github__create_issue"],
        },
      ],
    });
    const result = buildRelationships(harness);
    expect(result.toolNodes.has("Read")).toBe(true);
    const requires = result.edges.filter((e) => e.data.relation === "requires-tool");
    expect(requires.map((e) => e.data.target).sort()).toEqual([
      "mcp::github::project",
      "tool::Read",
    ]);
  });

  it("emits references edges only when MCP server resolves", () => {
    const harness = makeHarness({
      mcpServers: [
        {
          id: "github::user",
          name: "github",
          type: "stdio",
          envKeys: [],
          envRefs: [],
          source: "user",
          path: "/home/.mcp.json",
        },
      ],
      skills: [
        {
          id: "s",
          name: "s",
          description: "",
          source: "user",
          path: "/home/.claude/skills/s/SKILL.md",
          mcpRefs: ["github", "nonexistent"],
        },
      ],
    });
    const refs = buildRelationships(harness).edges.filter((e) => e.data.relation === "references");
    expect(refs).toHaveLength(1);
    expect(refs[0].data.target).toBe("mcp::github::user");
  });

  it("emits invokes edges from hook to skill via slash-command match", () => {
    const harness = makeHarness({
      hooks: [
        {
          id: "h",
          event: "UserPromptSubmit",
          command: "claude -p '/foo args'",
          source: "project",
          path: "/ws/.claude/settings.json",
        },
        {
          id: "h2",
          event: "PreToolUse",
          command: "node script.js",
          source: "project",
          path: "/ws/.claude/settings.json",
        },
      ],
      skills: [
        {
          id: "foo-id",
          name: "foo",
          description: "",
          source: "project",
          path: "/ws/.claude/skills/foo/SKILL.md",
        },
      ],
    });
    const invokes = buildRelationships(harness).edges.filter((e) => e.data.relation === "invokes");
    expect(invokes).toHaveLength(1);
    expect(invokes[0].data.source).toBe("hook::h");
    expect(invokes[0].data.target).toBe("skill::foo-id");
  });

  it("emits declared-in edges for entities sharing a config file", () => {
    const harness = makeHarness({
      hooks: [
        {
          id: "a",
          event: "PreToolUse",
          command: "echo a",
          source: "project",
          path: "/ws/.claude/settings.json",
        },
        {
          id: "b",
          event: "PostToolUse",
          command: "echo b",
          source: "project",
          path: "/ws/.claude/settings.json",
        },
      ],
    });
    const result = buildRelationships(harness);
    const declared = result.edges.filter((e) => e.data.relation === "declared-in");
    expect(declared).toHaveLength(2);
    expect(result.configFileNodes.has("/ws/.claude/settings.json")).toBe(true);
    expect(declared.every((e) => e.data.target === "configFile::/ws/.claude/settings.json")).toBe(
      true,
    );
  });

  it("does not emit declared-in for unique paths", () => {
    const harness = makeHarness({
      hooks: [
        {
          id: "lone",
          event: "PreToolUse",
          command: "echo",
          source: "project",
          path: "/ws/.claude/settings.json",
        },
      ],
    });
    const declared = buildRelationships(harness).edges.filter(
      (e) => e.data.relation === "declared-in",
    );
    expect(declared).toEqual([]);
  });
});
