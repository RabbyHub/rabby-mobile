# AGENTS.md

Agent guidance for this repository:

- Read `CLAUDE.md` for the main repo workflow and architecture notes.
- When working in `apps/mobile` on store, hooks, or Home-path logic, read `apps/mobile/skills/perf-hooks.md` before changing selector boundaries or exposing new store state to React consumers.
- When working in `apps/mobile` on startup path, AppNavigation, navigator loading, bundle splitting, loadables, or startup diagnostics, read `apps/mobile/skills/perf-startup-loadables.md` before changing imports, lazy-loading policy, preload timing, or startup instrumentation.
- Treat `apps/mobile/skills/perf-hooks.md` as the local performance playbook for scene-picked minimal state, reusable scene-level derived data, and avoiding render fan-out from overly broad subscriptions.
- Treat `apps/mobile/skills/perf-startup-loadables.md` as the local playbook for keeping the Unlock/GetStarted hot path small, using the generated loadables flow correctly, and separating development-time loading behavior from production startup optimization.
