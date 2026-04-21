# AGENTS.md

Agent guidance for this repository:

- Read `CLAUDE.md` for the main repo workflow and architecture notes.
- When working in `apps/mobile` on debug export or local file sharing flows, read `apps/mobile/skills/file-share.md` and reuse `src/utils/shareLocalFile.ts` instead of duplicating platform-specific share code.
- When patching, forking, or upgrading `react-native-keychain` in `apps/mobile`, read `apps/mobile/skills/keychain-upgrade.md` before changing Android behavior, fallback cipher selection, or package wiring.
- When working in `apps/mobile` on store, hooks, or Home-path logic, read `apps/mobile/skills/perf-hooks.md` before changing selector boundaries or exposing new store state to React consumers.
- Treat `apps/mobile/skills/perf-hooks.md` as the local performance playbook for scene-picked minimal state, reusable scene-level derived data, and avoiding render fan-out from overly broad subscriptions.
