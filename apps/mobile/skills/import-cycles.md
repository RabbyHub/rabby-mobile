---
name: mobile-import-cycles
description: When editing `apps/mobile` code, prevent new import cycles and run the mobile validation set: import-cycle detection, TypeScript typecheck, and Jest.
---

# Mobile Import Cycles

Use this guide for any `apps/mobile` code change.

## Required Validation

Before handing off code changes in `apps/mobile`, run:

```bash
yarn workspace rabby-mobile lint:cycles
yarn workspace rabby-mobile lint:cycles:eslint
yarn workspace rabby-mobile typecheck
yarn workspace rabby-mobile test --runInBand
```

If a change is very small and one of these commands is intentionally skipped,
state that clearly with the reason. Do not skip `lint:cycles` for code changes
that alter imports, exports, screen composition, hooks, stores, services, or
barrel files.

The import-cycle checks intentionally use different engines:

- `lint:cycles` uses Madge for fast graph-level cycle detection.
- `lint:cycles:eslint` runs `eslint-plugin-import`'s `import/no-cycle` as an
  error, catching resolver behavior that can differ from Madge.

## Import-Cycle Rules

- Do not import a screen, component, hook barrel, or package entry file just to
  reuse a type, constant, style helper, or pure calculation.
- Prefer a small pure file for shared primitives:
  - `types.ts` for shared types
  - `constants.ts` for constants
  - `utils/*.ts` for pure helpers
  - narrow hook files instead of `index.ts` barrels
- Use `import type` for type-only dependencies.
- Keep dependencies pointing downward:
  - core/services/apis should not import screens or React hooks
  - hooks should not import visual components just for helpers
  - child components should not import parent screen entry files
  - sibling features should share through a neutral file, not through each
    other
- Treat `index.ts` and `index.tsx` files as public entry points. Do not use them
  as internal helper modules when that would pull in extra imports.

## Common Fixes

- Move a reused exported type from a screen entry into `types.ts`.
- Move a reused constant from a parent component into `constants.ts`.
- Move a pure formatter/scorer into `utils/`.
- Replace `from '../hooks'` with a direct import from the specific hook/context
  file when only one export is needed.
- Split a controller/store bridge out of a React hook module when non-React code
  needs to call it.

The target state is zero circular dependencies from:

```bash
yarn workspace rabby-mobile lint:cycles
yarn workspace rabby-mobile lint:cycles:eslint
```
