# AGENTS.md

Agent guidance for this repository:

- Read `CLAUDE.md` for the main repo workflow and architecture notes.
- When working in `apps/mobile` on store, hooks, or Home-path logic, read `apps/mobile/skills/perf-hooks.md` before changing selector boundaries or exposing new store state to React consumers.
- When reviewing your own `apps/mobile` diff, or checking whether a refactor quietly changed business semantics, read `apps/mobile/skills/review-diff.md` and follow its findings-first review flow instead of trusting lint/typecheck alone.
- Treat `apps/mobile/skills/perf-hooks.md` as the local performance playbook for scene-picked minimal state, reusable scene-level derived data, and avoiding render fan-out from overly broad subscriptions.
