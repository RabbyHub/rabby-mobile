# AGENTS.md

Agent guidance for this repository:

- Read `CLAUDE.md` for the main repo workflow and architecture notes.
- When reviewing a Rabby Mobile pull request and publishing outbound findings, read `skills/rabby-mobile-code-review/SKILL.md`; use `skills/mobile-pr-ready-watch/SKILL.md` instead for making a PR ready or handling incoming review feedback.
- Consider runtime performance for every Rabby Mobile change. During review, read `skills/rabby-mobile-performance-review/SKILL.md` and perform its impact classification even when no benchmark is required and no public performance comment is warranted.
- When changing startup stages, module loading, lock/unlock routing, keyring readiness, visible/current account state, or first-Home readiness, read `skills/rabby-mobile-startup-governance/SKILL.md`. If safety or performance remains uncertain after review, request `@richardo2016x` review as described by the performance Review Skill.
- When working in `apps/mobile` on Google Play upload or Android store-release preflight flows, read `apps/mobile/skills/google-play-release.md` and preserve the repo's public `./scripts/google-play.sh upload-internal-track` workflow instead of documenting or committing private `.codex` helpers.
- When working in `apps/mobile` on debug export or local file sharing flows, read `apps/mobile/skills/file-share.md` and reuse `src/utils/shareLocalFile.ts` instead of duplicating platform-specific share code.
- When patching, forking, or upgrading `react-native-keychain` in `apps/mobile`, read `apps/mobile/skills/keychain-upgrade.md` before changing Android behavior, fallback cipher selection, or package wiring.
- When working in `apps/mobile` on i18n locale files or translation backfills, read `apps/mobile/skills/i18n-translation.md` and respect `__skip_translation` markers before adding missing keys.
- When working in `apps/mobile` on fixed bottom buttons, bottom-sheet footer buttons, modal action rows, or footer spacing, read `apps/mobile/skills/bottom-buttons.md` and reuse the shared constants from `src/constant/layout.ts`.
- When choosing, writing, reviewing, or reorganizing Rabby Mobile tests, read `skills/rabby-mobile-testing/SKILL.md` and classify coverage as unit, JS integration, Hermes device integration, or E2E before selecting mocks and tools.
- When editing `apps/mobile` code, read `apps/mobile/skills/import-cycles.md` and treat `yarn workspace rabby-mobile lint:cycles`, `yarn workspace rabby-mobile lint:cycles:eslint`, `yarn workspace rabby-mobile typecheck`, `yarn workspace rabby-mobile test --runInBand`, and `yarn workspace rabby-mobile test:integration:ci` as the required self-validation set before handoff.
- When working in `apps/mobile` on stores, hooks, lists, Home-path logic, or mounted-but-inactive Screens, read `apps/mobile/skills/perf-hooks.md` before changing selector or subscription boundaries. Every Home change must be checked for render fan-out and inactive subscription work, including transitive shared-state changes outside `src/screens/Home/**`.
- Treat `apps/mobile/skills/perf-hooks.md` as the local performance playbook for minimal state, update locality, reusable scene-level derived data, activity-aware subscriptions, and avoiding render fan-out.
- When working in `apps/mobile` on SQLite persistence, resource cache sync, TypeORM/op-sqlite `executeBatch`/`upsert` code, app-data-source reset, or clear-cache behavior, read `apps/mobile/skills/db-sync-writes.md` before changing DB write paths.
- When adding non-production automation, typed behavior injection, lifecycle observation, or future performance instrumentation to a Screen, component, or local feature boundary in `apps/mobile`, read `skills/mobile-testable-component-boundaries/SKILL.md`.
