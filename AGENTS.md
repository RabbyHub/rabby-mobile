# AGENTS.md

Agent guidance for this repository:

- Read `CLAUDE.md` for the main repo workflow and architecture notes.
- When working in `apps/mobile` on Google Play upload or Android store-release preflight flows, read `apps/mobile/skills/google-play-release.md` and preserve the repo's public `./scripts/google-play.sh upload-internal-track` workflow instead of documenting or committing private `.codex` helpers.
- When working in `apps/mobile` on debug export or local file sharing flows, read `apps/mobile/skills/file-share.md` and reuse `src/utils/shareLocalFile.ts` instead of duplicating platform-specific share code.
- When patching, forking, or upgrading `react-native-keychain` in `apps/mobile`, read `apps/mobile/skills/keychain-upgrade.md` before changing Android behavior, fallback cipher selection, or package wiring.
- When working in `apps/mobile` on i18n locale files or translation backfills, read `apps/mobile/skills/i18n-translation.md` and respect `__skip_translation` markers before adding missing keys.
- When working in `apps/mobile` on fixed bottom buttons, bottom-sheet footer buttons, modal action rows, or footer spacing, read `apps/mobile/skills/bottom-buttons.md` and reuse the shared constants from `src/constant/layout.ts`.
- When editing `apps/mobile` code, read `apps/mobile/skills/import-cycles.md` and treat `yarn workspace rabby-mobile lint:cycles`, `yarn workspace rabby-mobile lint:cycles:eslint`, `yarn workspace rabby-mobile typecheck`, and `yarn workspace rabby-mobile test --runInBand` as the required self-validation set before handoff.
- When working in `apps/mobile` on store, hooks, or Home-path logic, read `apps/mobile/skills/perf-hooks.md` before changing selector boundaries or exposing new store state to React consumers.
- Treat `apps/mobile/skills/perf-hooks.md` as the local performance playbook for scene-picked minimal state, reusable scene-level derived data, and avoiding render fan-out from overly broad subscriptions.
