# Dogfood checklist — v0.1.0

Use this as a week-one scratchpad while the extension is installed locally
(`code --install-extension yggdrasill-0.1.0.vsix`). If any line reveals a bug,
file it against [the issue tracker][issues] using the **Bug report** template.

[issues]: https://github.com/yusuke-oki-06/yggdrasill/issues/new/choose

## Day 1 — baseline smoke

- [ ] Open a workspace that already has a Claude Code `.claude/` directory
- [ ] Confirm the 🌳 **Yggdrasill** activity icon appears
- [ ] Click it — Harness tree populates without an error toast
- [ ] Every category shows a non-zero count except the ones that are genuinely empty for your harness (Skills, Hooks, MCP Servers, Memory, Permissions, Rules, CLAUDE.md / AGENTS.md, Environment, Parse Issues, Inconsistencies)
- [ ] Command palette → `Yggdrasill: Open Blueprint` opens the WebView
- [ ] The Blueprint renders Claude Code roughly in the middle
- [ ] Heavy categories (pluginGroup / memory / tool) open collapsed by default
- [ ] Click any collapsed card — it expands inline and the layout re-flows
- [ ] Click an entity card — the corresponding file opens in a real editor tab

## Day 2 — edges & analyzer

- [ ] At least one `overrides` edge is visible on a workspace that has the same-named skill in both project and user scope
- [ ] At least one `requires-tool` edge connects a skill to a tool or MCP node
- [ ] Any skill with a missing / empty `description` shows the red inconsistency dot
- [ ] Problems panel lists the matching `skill.missing-description`, `mcp.missing-env`, etc. entries under the "Yggdrasill" source
- [ ] The Inconsistencies sidebar category mirrors the Problems panel counts

## Day 3 — interactions

- [ ] `Show plugin skills` toggle expands pluginGroup children and re-layouts
- [ ] `Show env`, `Show permissions` toggles work symmetrically (off → on → off)
- [ ] Layout selector flips between "left → right" and "top → bottom" cleanly
- [ ] Search box — typing a skill name fades non-matches and force-expands heavy collapsed categories so the hit is visible
- [ ] Fit button reframes the canvas without clipping either end
- [ ] MiniMap is in the bottom-left, Controls bottom-right

## Day 4 — session watcher

Trigger the watcher by running a Claude Code session in the same workspace and having Claude hit:

- [ ] An `AskUserQuestion` tool_use → notification appears within a few seconds
- [ ] An `ExitPlanMode` tool_use → notification appears
- [ ] `yggdrasill.notifications.enabled: false` silences them (verify via settings JSON)

## Day 5 — regression surface

- [ ] Open a *different* workspace (no `.claude/`) — Sidebar shows zero counts, no error
- [ ] Reload Window — no dispose warnings, Blueprint panel re-opens if it was open (retainContextWhenHidden)
- [ ] Resize the Blueprint panel to ~600 px wide — content reflows without horizontal scroll bars stuck on
- [ ] Drag a skill card with the mouse — it moves (no crash)

## Day 6 — edge cases worth poking

- [ ] A plugin with 0 skills still appears somewhere (sidebar or analyzer warning) — not silently disappearing
- [ ] A permission with `allow` and `deny` on the exact same pattern renders a red `conflicts` edge in the Blueprint
- [ ] An MCP server with `command: "${FOO_BAR}"` where `$FOO_BAR` is unset surfaces `mcp.missing-env`
- [ ] Parser issue (e.g. malformed YAML frontmatter) shows up under the "Parse Issues" sidebar category
- [ ] Large harness (≥200 plugin skills) still renders within a second after toggling `Show plugin skills` on

## Day 7 — wrap-up

- [ ] Write a short note on what felt wrong (even if it did not rise to a bug)
- [ ] Star / unstarable plan items (from `media/screenshots/cco-vs-yggdrasill.png`) that need README updates
- [ ] Decide what ships in v0.1.1 vs v0.2

## Things to intentionally NOT check (out of scope for v0.1)

- `hook → skill` (`invokes`) and `skill body → MCP tool` (`references`) edges on real data — synthetic data confirms the code path works; real harnesses rarely have them
- Plugin → Hook / MCP ownership — parser does not yet surface this
- Memory-to-memory cross references — parser does not yet scan memory bodies
