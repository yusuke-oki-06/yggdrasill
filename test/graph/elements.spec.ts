import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildGraph } from "../../src/graph/elements.js";
import { parseHarness } from "../../src/parser/index.js";
import { makeFixture } from "../parser/fixtures.js";

describe("buildGraph", () => {
  let fx: Awaited<ReturnType<typeof makeFixture>>;

  beforeEach(async () => {
    fx = await makeFixture();
  });

  afterEach(async () => {
    await fx.cleanup();
  });

  it("produces nodes for every harness category and edges from the workspace root", async () => {
    const harness = await parseHarness(fx.root, { memoryRoot: path.join(fx.root, "memory") });
    const graph = buildGraph(harness, { includeEnv: true, includePermissions: true });

    const kinds = new Set(graph.nodes.map((n) => n.data.kind));
    expect(kinds).toContain("workspace");
    expect(kinds).toContain("skill");
    expect(kinds).toContain("mcp");
    expect(kinds).toContain("hook");
    expect(kinds).toContain("memory");
    expect(kinds).toContain("permission");
    expect(kinds).toContain("rule");
    expect(kinds).toContain("claudeMd");
    expect(kinds).toContain("plugin");

    const workspace = graph.nodes.find((n) => n.data.kind === "workspace");
    expect(workspace).toBeDefined();
    const workspaceId = workspace!.data.id;
    expect(graph.edges.some((e) => e.data.source === workspaceId)).toBe(true);

    const mcp = graph.nodes.find((n) => n.data.kind === "mcp" && n.data.label === "github");
    expect(mcp).toBeDefined();
    const envEdge = graph.edges.find(
      (e) => e.data.source === mcp!.data.id && e.data.relation === "needs-env",
    );
    expect(envEdge).toBeDefined();

    expect(
      graph.edges.every((e) => e.data.kind === "ownership" || e.data.kind === "relationship"),
    ).toBe(true);
    expect(envEdge!.data.kind).toBe("ownership");
  });

  it("merges relationship edges and synthesizes tool/configFile nodes", async () => {
    const harness = await parseHarness(fx.root);
    const graph = buildGraph(harness);

    const toolNode = graph.nodes.find((n) => n.data.kind === "tool" && n.data.label === "Read");
    expect(toolNode).toBeDefined();

    const requiresEdges = graph.edges.filter(
      (e) => e.data.relation === "requires-tool" && e.data.kind === "relationship",
    );
    expect(requiresEdges.length).toBeGreaterThan(0);
    expect(requiresEdges.some((e) => e.data.target === toolNode!.data.id)).toBe(true);

    const referencesEdge = graph.edges.find(
      (e) => e.data.relation === "references" && e.data.kind === "relationship",
    );
    expect(referencesEdge).toBeDefined();
  });

  it("groups plugin skills under pluginGroup parents", async () => {
    const harness = await parseHarness(fx.root);
    // Inject synthetic plugin skills to exercise the pluginGroup path.
    harness.skills.push(
      {
        id: "p1",
        name: "alpha",
        description: "",
        source: "plugin",
        path: "/tmp/alpha/SKILL.md",
        pluginNamespace: "acme",
        pluginName: "demo-plugin",
      },
      {
        id: "p2",
        name: "beta",
        description: "",
        source: "plugin",
        path: "/tmp/beta/SKILL.md",
        pluginNamespace: "acme",
        pluginName: "demo-plugin",
      },
    );
    const graph = buildGraph(harness, { includePluginSkills: true });

    const group = graph.nodes.find((n) => n.data.kind === "pluginGroup");
    expect(group).toBeDefined();
    expect(group?.data.label).toBe("demo-plugin");

    const groupChildren = graph.nodes.filter((n) => n.data.parent === group!.data.id);
    expect(groupChildren.length).toBeGreaterThanOrEqual(2);
    expect(groupChildren.every((c) => c.data.kind === "skill")).toBe(true);
  });

  it("hides env and permission nodes by default and emits them when toggled", async () => {
    const harness = await parseHarness(fx.root, { memoryRoot: path.join(fx.root, "memory") });
    const defaultGraph = buildGraph(harness);
    const defaultKinds = new Set(defaultGraph.nodes.map((n) => n.data.kind));
    expect(defaultKinds.has("env")).toBe(false);
    expect(defaultKinds.has("permission")).toBe(false);

    const opened = buildGraph(harness, { includeEnv: true, includePermissions: true });
    const openedKinds = new Set(opened.nodes.map((n) => n.data.kind));
    expect(openedKinds.has("env")).toBe(true);
    expect(openedKinds.has("permission")).toBe(true);
  });

  it("hides plugin skill leaves by default but keeps the pluginGroup node", async () => {
    const harness = await parseHarness(fx.root);
    harness.skills.push({
      id: "p1",
      name: "alpha",
      description: "",
      source: "plugin",
      path: "/tmp/alpha/SKILL.md",
      pluginNamespace: "acme",
      pluginName: "demo-plugin",
    });
    const graph = buildGraph(harness);
    const group = graph.nodes.find((n) => n.data.kind === "pluginGroup");
    expect(group).toBeDefined();
    expect(graph.nodes.some((n) => n.data.id === "skill::p1")).toBe(false);
  });

  it("does not place ownership children under a workspace compound", async () => {
    const harness = await parseHarness(fx.root);
    const graph = buildGraph(harness);
    const workspace = graph.nodes.find((n) => n.data.kind === "workspace")!;
    const childUnderWorkspace = graph.nodes.find((n) => n.data.parent === workspace.data.id);
    expect(childUnderWorkspace).toBeUndefined();
  });
});
