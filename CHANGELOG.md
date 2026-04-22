# Changelog

All notable changes to Yggdrasill will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.2] - 2026-04-22

Finishing the Marketplace listing polish started in 0.1.1.

### Changed
- The "Why another Claude Code tool?" side-by-side image now
  uses the real-harness blueprint capture on the right (the
  35-node layer-band view), not the synthetic demo.
- Gallery screenshots (`blueprint-memory-expanded.png`,
  `blueprint-search.png`) regenerated from the demo with layer
  bands + smoothstep routing so they match the hero visually.

## [0.1.1] - 2026-04-22

Marketplace launch polish. Same feature surface as 0.1.0; this
release is about what the listing looks like to someone who just
found the extension.

### Changed
- Marketplace displayName is now "Yggdrasill — Harness Graph" so
  the card says what the extension does at a glance (the bare
  "Yggdrasill" was already claimed by Runespeakers.ygg).
- README hero image swapped from the synthetic demo capture to a
  real Extension-Development-Host screenshot of this repo's own
  Claude Code harness — 35 nodes across all seven labeled layer
  bands (L0 Foundation through L6 Config files), showing override
  edges, smoothstep ownership routing, declared-in edges, and
  live MCP servers.
- README refreshed with Marketplace / Installs / CI / License
  badges, a Security posture section, a gallery with the
  memory-expanded and search-focus screenshots, and the primary
  install path set to `ext install yusuke-oki-06.yggdrasill`.

### Security
- Env values are no longer rendered anywhere in the UI. The graph
  and the sidebar now display `(set)` / `(missing)` / `(empty)`
  instead of the raw value, so a shared screenshot or screen cast
  can never leak an API token or PAT. The value is still
  accessible via the settings.json file it came from.

## [0.1.0] - 2026-04-21

First public preview. The point of this release is the **relationship graph**:
the unique view of how your Claude Code harness pieces actually connect.

### Added

#### Harness model
- Parser that walks the active workspace and merges `~/.claude/settings.json`,
  the project `settings.json` / `settings.local.json`, `.mcp.json`,
  `CLAUDE.md` / `AGENTS.md`, `.claude/rules/`, `~/.claude/skills/`, project
  `.claude/skills/`, `~/.claude/plugins/cache/<ns>/<plugin>/.../skills/`, and
  the per-project memory directory into a single Zod-validated `Harness`
  intermediate representation.
- Skill frontmatter capture (`tools` / `allowed-tools`) and SKILL.md body
  scan for `mcp__<server>__<tool>` references; both surface as graph edges
  (`requires-tool`, `references`).
- MCP server parsing splits declared env keys from `${PLACEHOLDER}` references
  so the analyzer can flag truly missing values without false positives.

#### Sidebar (Harness TreeView)
- Activity Bar container with a tree per category: Skills, Hooks, MCP Servers,
  Memory, Permissions, Rules, CLAUDE.md / AGENTS.md, Environment, Parse
  Issues, Inconsistencies.
- Source grouping (project / local / user / plugin) for categories that span
  multiple sources, plus per-namespace plugin grouping for the Plugin source
  of Skills.
- Auto-collapse threshold so 200+ skill trees do not blow up on open.

#### Blueprint (relationship graph)
- React + `@xyflow/react` WebView with custom Card nodes, animated colored
  edges per relation type, MiniMap, Controls and a translucent radial
  background.
- ELK `layered` algorithm with `aspectRatio: 1.78` plus loading-order
  partitioning so columns flow left → right in the order Claude Code
  composes a session, with **Claude Code itself in the middle column**:
  CLAUDE.md/rules → plugins/env → skills/MCP/memory → Claude Code →
  hooks → tools/permissions → config files. Entities within each
  category compound are sorted by source precedence (project > local
  > user > plugin) so the higher-priority definition sits on top.
- Compound `categoryGroup` parent nodes give every kind a labeled visual
  container with kind-tinted gradients. Categories with more than 15
  children (memory, plugins, tools, …) auto-collapse to a summary card
  on first render; clicking the card expands the category inline. The
  search box temporarily expands every category so hits remain visible.
- Toolbar: search filter, layout direction (left → right / top → bottom),
  and toggles for plugin skills / env / permissions (off by default to
  reduce noise; toggling re-renders).
- Seven relationship edge kinds derived purely from the parsed `Harness`:
  `owns` (plugin → skill), `overrides` (higher-precedence entity → the
  same-named entry it shadows), `conflicts` (allow + deny same permission
  pattern), `requires-tool` (skill → tool / MCP), `references` (skill body
  → MCP), `invokes` (hook command → skill name), `declared-in` (entity →
  shared config file). The `overrides` and `conflicts` edges render in
  bold gold/red so override resolution and policy collisions are visible
  at a glance.
- Edges are tagged `ownership` vs `relationship`; ownership renders dim
  and thin so the relationship layer is the visual focus.
- Inconsistency badges: nodes flagged by analyzer rules render with a red
  dot.

#### Static analyzer
- Five rules: `skill.duplicate-name`, `skill.missing-description`,
  `mcp.missing-env`, `hook.empty-command`, `plugin.missing-install`.
- Results published to a `vscode.languages.DiagnosticCollection` so they
  show up in the Problems panel, and surfaced as a top-level Sidebar
  category.

#### Sessions watcher
- File watcher on `~/.claude/projects/<slug>/*.jsonl` for the active
  workspace.
- Tail parsing detects `AskUserQuestion`, `ExitPlanMode` and
  `permission_request` events and shows an "Open Transcript" notification.
  Honors the `yggdrasill.notifications.enabled` setting; deduplicates by
  file size to avoid repeating on unrelated edits.

#### Commands & configuration
- `Yggdrasill: Hello`, `Yggdrasill: Open Blueprint`, `Yggdrasill: Refresh
  Harness`.
- Settings: `yggdrasill.notifications.enabled`,
  `yggdrasill.parser.memoryRoot`.

### Changed
- Migrated the Blueprint WebView from cytoscape.js to React + react-flow
  for a modern card-based UI.
- Switched the auto-layout from dagre to ELK so the graph respects 16:9
  display aspect ratios instead of growing into a single tall column.

### Removed
- Cytoscape and `cytoscape-fcose` dependencies (replaced by react-flow +
  ELK).
- `plugin` graph nodes and the standalone Sidebar `Plugins` category —
  both duplicated the namespace plugin grouping under Skills and the
  `plugin.missing-install` analyzer.

### Fixed
- Blueprint edges no longer dangle when a category is collapsed: each
  edge whose endpoint sits inside a collapsed compound is rerouted to
  the parent categoryGroup (with deduplication) instead of being passed
  to ELK and crashing the layout.
