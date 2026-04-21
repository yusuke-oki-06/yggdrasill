// Synthetic but realistic GraphElements payload for Blueprint screenshots.
// Shape must match what src/views/blueprint/blueprintPanel.ts posts:
//   { type: "update", elements: { nodes:[{data}], edges:[{data}] }, issueTargets:[] }
window.__YGGDRASILL_DEMO_PAYLOAD__ = (() => {
  const nodes = [];
  const edges = [];

  function node(data) {
    nodes.push({ data });
  }
  function edge(source, target, relation, kind = "ownership") {
    edges.push({
      data: {
        id: `${source}->${target}::${relation}`,
        source,
        target,
        relation,
        kind,
      },
    });
  }

  // Center: Claude Code
  const claudeId = "workspace::root";
  node({
    id: claudeId,
    label: "Claude Code",
    kind: "workspace",
    description: "yggdrasill",
    path: "/workspace/yggdrasill",
  });

  // CLAUDE.md / AGENTS.md -> defines Claude
  ["CLAUDE.md", "AGENTS.md"].forEach((kindName, i) => {
    const id = `claudeMd::${kindName}`;
    node({
      id,
      label: kindName,
      kind: "claudeMd",
      source: i === 0 ? "project" : "user",
      path: `/workspace/${kindName}`,
    });
    edge(id, claudeId, "defines");
  });

  // Rules -> constrain Claude
  ["typescript", "testing", "style"].forEach((name, i) => {
    const id = `rule::${name}`;
    node({
      id,
      label: name,
      kind: "rule",
      source: i === 0 ? "project" : "user",
      path: `/.claude/rules/${name}.md`,
    });
    edge(id, claudeId, "constrains");
  });

  // MCP servers -> connect to Claude
  ["github", "notion", "context7", "serena"].forEach((name) => {
    const id = `mcp::${name}`;
    node({
      id,
      label: name,
      kind: "mcp",
      source: "project",
      description: "stdio",
      path: "/workspace/.mcp.json",
    });
    edge(id, claudeId, "connects");
  });

  // Project skills -> extend Claude
  const projectSkills = [
    { name: "planner", desc: "Plan multi-step features" },
    { name: "code-reviewer", desc: "Review code against standards" },
    { name: "tdd-guide", desc: "" }, // empty -> triggers inconsistency
  ];
  projectSkills.forEach(({ name, desc }) => {
    const id = `skill::${name}::project`;
    node({
      id,
      label: name,
      kind: "skill",
      source: "project",
      description: desc,
      path: `/workspace/.claude/skills/${name}/SKILL.md`,
    });
    edge(id, claudeId, "extends");
  });

  // One user-source skill with same name as a project one -> overrides edge
  const userSkillId = "skill::code-reviewer::user";
  node({
    id: userSkillId,
    label: "code-reviewer",
    kind: "skill",
    source: "user",
    description: "Older user-level version",
    path: "/home/.claude/skills/code-reviewer/SKILL.md",
  });
  edge(userSkillId, claudeId, "extends");
  // overrides edge (relationship)
  edge("skill::code-reviewer::project", userSkillId, "overrides", "relationship");

  // Hooks <- Claude triggers
  ["PreToolUse", "PostToolUse", "UserPromptSubmit", "Stop"].forEach((event) => {
    const id = `hook::${event}`;
    node({
      id,
      label: event,
      kind: "hook",
      source: "project",
      description: event === "PreToolUse" ? "Bash · validate" : "node script",
      path: "/workspace/.claude/settings.json",
    });
    edge(claudeId, id, "triggers");
  });

  // Tools (built-in)
  const tools = ["Read", "Write", "Edit", "Bash", "Grep", "Glob"];
  tools.forEach((t) => {
    node({ id: `tool::${t}`, label: t, kind: "tool" });
  });

  // requires-tool edges (relationship)
  edge("skill::planner::project", "tool::Read", "requires-tool", "relationship");
  edge("skill::planner::project", "tool::Grep", "requires-tool", "relationship");
  edge("skill::code-reviewer::project", "tool::Read", "requires-tool", "relationship");
  edge("skill::code-reviewer::project", "tool::Bash", "requires-tool", "relationship");
  edge("skill::tdd-guide::project", "tool::Bash", "requires-tool", "relationship");
  edge("skill::tdd-guide::project", "tool::Write", "requires-tool", "relationship");

  // references edge (skill body -> MCP)
  edge("skill::code-reviewer::project", "mcp::github", "references", "relationship");

  // Plugin groups (heavy category -> auto-collapsed)
  const plugins = [
    ["claude-plugins-official", "everything-claude-code"],
    ["claude-plugins-official", "playwright"],
    ["claude-plugins-official", "serena"],
    ["claude-plugins-official", "github"],
    ["anthropic-agent-skills", "skill-creator"],
    ["community-plugins", "superpowers"],
    ["community-plugins", "slack"],
    ["community-plugins", "notion"],
    ["community-plugins", "linear"],
    ["community-plugins", "gitlab"],
    ["community-plugins", "jira"],
    ["community-plugins", "sentry"],
    ["community-plugins", "datadog"],
    ["community-plugins", "prometheus"],
    ["community-plugins", "redis"],
    ["community-plugins", "postgres"],
    ["community-plugins", "mongo"],
    ["community-plugins", "ui-ux-pro-max"],
  ];
  plugins.forEach(([ns, name]) => {
    const id = `pluginGroup::${ns}::${name}`;
    node({
      id,
      label: name,
      kind: "pluginGroup",
      source: "plugin",
      description: `${ns} · 6 skills`,
    });
    edge(id, claudeId, "extends");
  });

  // Memory entries (heavy -> auto-collapsed)
  for (let i = 0; i < 22; i++) {
    const id = `memory::entry-${i}`;
    node({
      id,
      label: ["user-role", "feedback-testing", "project-goal", "api-key-vault", "team-workflow"][i % 5] + (i >= 5 ? `-${i}` : ""),
      kind: "memory",
      source: i < 10 ? "project" : "user",
      description: ["user", "feedback", "project", "reference"][i % 4],
      path: `/memory/entry-${i}.md`,
    });
    edge(id, claudeId, "informs");
  }

  return {
    type: "update",
    elements: { nodes, edges },
    // Red badge on tdd-guide (missing description)
    issueTargets: ["skill::tdd-guide::project"],
  };
})();
