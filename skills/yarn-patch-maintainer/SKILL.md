---
name: yarn-patch-maintainer
description: Create, refresh, or clean Yarn `patch:` dependencies in this repository without leaking generated build artifacts into `.yarn/patches`. Use when Codex needs to update an existing patched dependency, regenerate a patch from local package edits, remove accidental build outputs from a patch file, or reconcile a workspace dependency such as `apps/mobile/package.json` with the checked-in patch under `.yarn/patches`.
---

# Yarn Patch Maintainer

Use this skill to keep patched third-party dependencies reproducible and reviewable.

Prefer Yarn's own `patch` and `patch-commit` workflow over hand-written diffs.

## Workflow

1. Find the workspace that owns the dependency.

   In this repo, `react-native-keychain` is owned by [apps/mobile/package.json](../../apps/mobile/package.json).

2. Run `yarn patch <locator>` from that workspace.

   Example:

   ```bash
   cd apps/mobile
   yarn patch react-native-keychain@npm:9.2.3 --json
   ```

   Record the returned temporary patch directory.

3. Apply edits inside the temporary directory.

   Prefer direct edits there.

   If the working changes already exist under `node_modules`, copy only source files back into the patch directory and explicitly exclude generated outputs such as:

   - `android/build`
   - `ios/build`
   - `.gradle`
   - `build`
   - compiled bundles, dex files, or cache directories

   Example:

   ```bash
   patch_dir='<path returned by yarn patch>'
   rsync -a --delete \
     --exclude 'android/build' \
     --exclude 'ios/build' \
     apps/mobile/node_modules/react-native-keychain/ \
     "$patch_dir/"
   ```

4. Commit the patch with Yarn.

   ```bash
   cd apps/mobile
   yarn patch-commit -s "$patch_dir"
   ```

5. Inspect the generated patch file under [.yarn/patches](../../.yarn/patches).

   Reject the result if it contains generated files or opaque binary deltas.

## Checks

Run these checks after `patch-commit`:

```bash
git diff -- .yarn/patches
rg -n "android/build|ios/build|\\.gradle|\\.dex|results\\.bin|transforms" .yarn/patches/<patch-file>
```

The second command should return nothing for a clean source-only patch.

## Repo-Specific Notes

- This repo uses Yarn 4 with `nodeLinker: node-modules`; local edits often happen under `apps/mobile/node_modules/...`, but those edits are only staging material and should be re-serialized through `yarn patch`.
- The checked-in patch files live at the repo root under `.yarn/patches`, even when the owning dependency is declared from a workspace package.
- After `yarn patch-commit -s`, re-check the dependency entry in the workspace manifest. If Yarn rewrites the patch locator to an incorrect path such as `~/.yarn/patches/...`, restore the repo-relative path that matches the checked-in file.

For `apps/mobile/package.json`, the correct pattern is:

```json
"react-native-keychain": "patch:react-native-keychain@npm%3A9.2.3#../../.yarn/patches/react-native-keychain-npm-9.2.3-455dffb765.patch"
```

## Rules

- Do not regenerate a patch from a raw `git diff` between cache zips and `node_modules` unless Yarn's own patch flow is blocked.
- Do not keep build outputs inside `.yarn/patches`, even if they came from the local installed package.
- Do not assume `patch-commit` preserved the workspace manifest path correctly; inspect it.
- Keep the patch narrowly scoped to the package sources and tests that need to be versioned.

## Reporting

When you finish a patch refresh, report:

- the workspace where you ran `yarn patch`
- the package locator you patched
- the patch file path under `.yarn/patches`
- whether you had to fix the workspace manifest path manually
- whether the patch was checked for generated artifacts
