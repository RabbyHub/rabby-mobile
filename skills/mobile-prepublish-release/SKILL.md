---
name: mobile-prepublish-release
description: Prepare a Rabby Mobile publish PR from a clean branch by bumping the `apps/mobile` version, running `yarn rnversion`, creating a default changelog when missing, committing `build: publish <version>`, and opening a GitHub PR when `gh` is available. Use when Codex needs to cut a mobile publish branch or automate the routine release-prep steps.
---

# Mobile Prepublish Release

Use the repo script:

```bash
yarn workspace rabby-mobile prepublish:release
```

Pass an explicit version when needed:

```bash
yarn workspace rabby-mobile prepublish:release --version=0.6.68
```

## Behavior

- If `--version` is omitted, the script increments the patch version from `origin/develop`'s `apps/mobile/package.json`.
- The script fetches `origin/develop` and switches the current checkout to `publish/<version>`, reusing an existing local or remote publish branch when present.
- The script runs `yarn rnversion` from `apps/mobile`.
- If no changelog exists for the target version in:
  - `apps/mobile/src/changeLogs/<version>.md`
  - `apps/mobile/src/changeLogs/<version>.ios.md`
  - `apps/mobile/src/changeLogs/<version>.android.md`
  it creates `apps/mobile/src/changeLogs/<version>.md` with the default release copy.
- The script commits with `build: publish <version>`.
- If `gh` is installed, the script pushes the branch and creates or updates a PR to `develop` with the same title.

## Rules

- Start from a clean worktree.
- Prefer the existing publish branch convention `publish/<version>`.
- Expect the script to change your current branch to `publish/<version>`.
- Use `--dry-run` if you want to inspect the version bump and changelog creation without committing or opening a PR.

## Report

After running the script, report:

- target version
- branch name
- commit SHA
- PR URL when one was created
