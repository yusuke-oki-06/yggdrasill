# Yggdrasil

> Visualize the Claude Code harness — skills, hooks, tools, MCP, memory, settings — as one graph.

Yggdrasil (ユグドラシル) is a VS Code extension that turns your Claude Code workspace into a navigable graph. Named after the Norse world tree that connects the nine realms, it renders how your `skills`, `hooks`, `tools`, `MCP servers`, `memory`, and `settings` interlock — across every project you work in.

## Why

Claude Code has rich configuration surfaces (`settings.json`, `CLAUDE.md`, `skills/`, `hooks`, `.mcp.json`, memory), and the community already offers great tools for sessions (wmux, cmux, official Desktop), events (disler observability), and skill dependencies (skill-deps, SkillsMP). What is still missing is a **holistic, multi-project blueprint viewer**: one place to see the entire harness, spot inconsistencies, and get notified when a session needs your attention. Yggdrasil fills that gap.

## Status

**v0.0.1 — scaffold.** Hello World command only. See `docs/` and the roadmap below.

## Features (planned v0.1)

1. **Harness Parser** — reads `settings.json`, `skills/**/*.md`, `.mcp.json`, `MEMORY.md`, hooks, permissions, and plugins into a single model.
2. **Blueprint Graph** — Cytoscape-powered graph of the entire harness with search, filter, and click-to-open.
3. **Inconsistency Detector** — static analysis that surfaces missing plugins, broken MCP env vars, duplicate skill names, orphaned memory refs, etc.
4. **Multi-project Support** — works across VS Code multi-root workspaces.
5. **Input-Required Notification** — watches session logs and pings you when Claude Code is waiting on a question, plan approval, or permission.

## Commands

- `Yggdrasil: Hello`
- `Yggdrasil: Open Blueprint` *(coming in Phase 2)*

## Development

```bash
npm install
npm run dev          # esbuild watch
# F5 in VS Code      # launch Extension Development Host
npm run typecheck
npm test
npm run package      # build .vsix
```

## License

MIT
