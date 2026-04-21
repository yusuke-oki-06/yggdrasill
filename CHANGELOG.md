# Changelog

All notable changes to Yggdrasill will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

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
  container with kind-tinted gradients.
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

### Known issues
- Blueprint density: a busy harness (lots of enabled plugins + memory)
  can still spill past one viewport even with all default filters
  applied. Compact-by-default collapsing of heavy categories is
  scheduled for v0.2.
