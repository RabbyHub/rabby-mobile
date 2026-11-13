---
name: tmp-feature-test-release
description: Promote one or more committed changes onto the Thursday tmp branch, push the result without disturbing the current worktree, and dispatch the Rabby Mobile Feature Test workflow that now lives in `RabbyHub/rabby-ci`. Use when Codex needs to merge a fix into `tmp/YYYYMMDD`, especially the current Thursday tmp branch, and start a feature test build.
---

# Tmp Feature Test Release

Prefer the bundled script for this workflow:

```bash
skills/tmp-feature-test-release/scripts/promote_to_tmp_feature_test.sh --commit <sha>
```

Follow these rules:

- Start from committed changes only. Do not try to release uncommitted workspace state.
- Keep the user's main worktree untouched. Use the script's isolated worktree flow instead of switching branches in place.
- Default to the upcoming Thursday tmp branch in `Asia/Shanghai` unless the user names a different `tmp/*` branch.
- Assume the release target is `origin/develop` when the tmp branch does not exist yet. The script mirrors `.github/workflows/create_tmp_release_branch.yml` and creates the remote tmp branch from `origin/develop`.
- The packaging workflow is no longer part of this repository. It lives in `RabbyHub/rabby-ci` as
  `rabby-mobile-feature-test.yml`; this script pushes the tmp branch and dispatches that workflow with
  `-f target=both -f ref=<tmp branch> -f REALLY_UPLOAD=...`, so the runner choice and the cache
  toggles belong to rabby-ci now (`--machine` / `--pod-cache` / `--nm-cache` / `--gradle-cache` are
  accepted for compatibility and ignored).
- Prefer the prepared command from the fe-opcode console when you just need to re-run the build for an
  existing branch; this script is only for promoting commits onto the tmp branch first.
- Re-read [.github/workflows/create_tmp_release_branch.yml](../../.github/workflows/create_tmp_release_branch.yml) before editing branch-creation logic.

Use these examples as the default entry points:

```bash
# Release the current HEAD commit to this Thursday's tmp branch and trigger Feature Test
skills/tmp-feature-test-release/scripts/promote_to_tmp_feature_test.sh

# Release a specific fix commit to the current Thursday tmp branch
skills/tmp-feature-test-release/scripts/promote_to_tmp_feature_test.sh --commit 2dd2daa6b

# Override the tmp branch
skills/tmp-feature-test-release/scripts/promote_to_tmp_feature_test.sh \
  --commit 2dd2daa6b \
  --tmp-branch tmp/20260410
```

Report these values after running the script:

- target tmp branch
- pushed SHA
- Feature Test run URL, if dispatched
- any non-default flags you used

If cherry-pick fails, inspect the preserved worktree printed by the script and resolve conflicts there instead of modifying the user's original checkout.
