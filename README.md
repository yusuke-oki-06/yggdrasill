# Yggdrasill

> **Harness relationship graph for Claude Code, inside VS Code.**

Yggdrasill walks your active workspace, reads every Claude Code surface (`settings.json`, `CLAUDE.md`, `AGENTS.md`, `.mcp.json`, `skills/`, `memory/`, hooks, plugins, permissions), and renders **how they connect** — not just *what exists*.

![Blueprint hero](media/screenshots/blueprint-hero.png)

## Why another Claude Code tool?

There are already great extensions for browsing skills, listing MCP servers, and tracking session activity. None of them show **relationships**. A skill says it `requires-tool Bash` — which one? A plugin claims to *own* a skill — show me the link. A permission `allow` and a `deny` collide on the same pattern — make it impossible to miss. That is the gap Yggdrasill fills.

| | Browse | Tree | Graph | Relationships | Inside VS Code |
|---|---|---|---|---|---|
| CCO (mcpware) | ✓ | ✓ | — | — | — |
| Claude Code Tool Manager | ✓ | ✓ | — | — | — |
| Claudia / opcode | ✓ | — | — | — | — |
| Other VS Code skill browsers | ✓ | ✓ | — | — | ✓ |
| **Yggdrasill** | ✓ | ✓ | ✓ | ✓ | ✓ |

## Features

- **Harness parser** — merges every layer of Claude Code config (user / project / local / plugin) into one validated model, capturing skill frontmatter and SKILL.md body references.
- **Sidebar Harness tree** — every category (Skills, Hooks, MCP, Memory, Permissions, Rules, CLAUDE.md, Env) with source grouping and per-plugin namespace folders, right inside VS Code's Activity Bar.
- **Blueprint graph** — react-flow + ELK layout with **Claude Code in the middle** and the harness composed left → right in load order. Custom Card nodes per kind, colored animated relationship edges, search, layout switcher, plugin/env/permission toggles, MiniMap. Heavy categories (memory, plugins, …) auto-collapse to summary cards on first load — click any card to expand it inline.
- **Seven relationship edge kinds** — `owns`, `overrides`, `conflicts`, `requires-tool`, `references`, `invokes`, `declared-in`. All derived purely from the parsed harness, no extra IO. `overrides` and `conflicts` render in bold gold/red so override resolution and policy collisions are unmissable.
- **Static analyzer** — five inconsistency rules surfaced via the standard `Problems` panel and a dedicated *Inconsistencies* sidebar category. Nodes flagged by the analyzer get a red badge in the graph.
- **Sessions watcher** — tails `~/.claude/projects/<slug>/*.jsonl` for the active workspace and pings you when Claude Code is waiting on `AskUserQuestion`, `ExitPlanMode`, or a permission request.

## Install

While in preview:

```bash
code --install-extension yggdrasill-0.1.0.vsix
```

After Marketplace publish:

```
ext install yusuke-oki-06.yggdrasill
```

## Quickstart

1. Open any Claude Code workspace in VS Code.
2. Click the 🌳 **Yggdrasill** icon in the Activity Bar.
3. From the sidebar header, run **`Yggdrasill: Open Blueprint`** (or use the command palette).
4. Use the toolbar to filter, switch layout direction, or reveal plugin skills / env vars / permissions.

## Settings

| | Default | Description |
|---|---|---|
| `yggdrasill.notifications.enabled` | `true` | Show a notification when a Claude Code session needs your input. |
| `yggdrasill.parser.memoryRoot` | `""` | Override the inferred Claude Code memory directory. |

## Inconsistency rules

| Rule | Severity | Triggers |
|---|---|---|
| `skill.duplicate-name` | warning | Two skills share the same `name`. |
| `skill.missing-description` | warning | A skill has no `description` in frontmatter. |
| `mcp.missing-env` | warning | An MCP server references `${KEY}` that is not in `settings.json` or the shell. |
| `hook.empty-command` | warning | A hook entry has no command to run. |
| `plugin.missing-install` | warning | An enabled plugin is missing from `~/.claude/plugins/cache/`. |

## Loading-order layout

The Blueprint puts **Claude Code itself in the middle**, with the harness flowing into it from the left and the runtime triggering out to the right:

```
CLAUDE.md / rules  →  plugins / env  →  skills / MCP / memory  →  Claude Code  →  hooks  →  tools / permissions  →  config files
       L0                  L1                    L2                     L3            L4              L5                 L6
   foundation         declared            composed                 assembled       events         runtime              meta
```

Visual position teaches the system. Skills sit *to the left of* Claude (loaded into it); hooks sit *to the right* (triggered by it). Within each category column, entries are sorted by **source precedence** — project overrides at the top, then local, user, plugin — and prominent **`overrides`** edges connect higher-priority entries to the ones they shadow so you can see at a glance which definition wins.

## Development

```bash
npm install
npm run dev          # esbuild watch (extension + WebView bundle)
# Press F5 in VS Code to launch an Extension Development Host
npm run typecheck
npm test
npm run package      # build .vsix
```

The repo holds two TypeScript projects: the extension (`src/`, Node CJS) and the React WebView (`media/blueprint/`, browser IIFE). Both are bundled by `esbuild.config.mjs`.

## Roadmap

- Click-to-focus subgraph (1-2 hop neighborhood around a selected node).
- Edge-kind filter chips on the toolbar (toggle `invokes`, `overrides`, `requires-tool`, etc. independently).
- Selected-node detail panel with incoming / outgoing edge listing.
- Smarter edge aggregation when categories collapse (e.g. "12 references → MCP github" instead of the deduped single arrow we draw today).
- Slack-webhook variant of the input-required notification.
- Plugin → Hook / MCP `owns` extraction (parser extension).
- Memory-to-memory cross-reference detection.

## License

MIT
