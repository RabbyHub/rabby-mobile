---
name: tmp-feature-test-release
description: Promote one or more committed changes onto the Friday tmp branch, push the result without disturbing the current worktree, and dispatch the Feature Test GitHub Actions workflow. Use when Codex needs to merge a fix into `tmp/YYYYMMDD`, especially the current Friday tmp branch, and start a feature test build with explicit runner or cache settings.
---

# Tmp Feature Test Release

Prefer the bundled script for this workflow:

```bash
skills/tmp-feature-test-release/scripts/promote_to_tmp_feature_test.sh --commit <sha>
```

Follow these rules:

- Start from committed changes only. Do not try to release uncommitted workspace state.
- Keep the user's main worktree untouched. Use the script's isolated worktree flow instead of switching branches in place.
- Default to the upcoming Friday tmp branch in `Asia/Shanghai` unless the user names a different `tmp/*` branch.
- Assume the release target is `origin/develop` when the tmp branch does not exist yet. The script mirrors `.github/workflows/create_tmp_friday_branch.yml` and creates the remote tmp branch from `origin/develop`.
- Default Feature Test inputs to the release-friendly path used most often here: `mobile-local`, pod cache enabled, node_modules cache enabled, gradle cache enabled, and `REALLY_UPLOAD=true`.
- Re-read [.github/workflows/feature_test.yml](/Users/workrichard/projects/RabbyHub/rabby-mobile/.github/workflows/feature_test.yml) before editing the script if the workflow inputs may have changed.
- Re-read [.github/workflows/create_tmp_friday_branch.yml](/Users/workrichard/projects/RabbyHub/rabby-mobile/.github/workflows/create_tmp_friday_branch.yml) before editing branch-creation logic.

Use these examples as the default entry points:

```bash
# Release the current HEAD commit to this Friday's tmp branch and trigger Feature Test
skills/tmp-feature-test-release/scripts/promote_to_tmp_feature_test.sh

# Release a specific fix commit to the current Friday tmp branch
skills/tmp-feature-test-release/scripts/promote_to_tmp_feature_test.sh --commit 2dd2daa6b

# Override the tmp branch or runner
skills/tmp-feature-test-release/scripts/promote_to_tmp_feature_test.sh \
  --commit 2dd2daa6b \
  --tmp-branch tmp/20260410 \
  --machine mobile
```

Report these values after running the script:

- target tmp branch
- pushed SHA
- Feature Test run URL, if dispatched
- any non-default flags you used

If cherry-pick fails, inspect the preserved worktree printed by the script and resolve conflicts there instead of modifying the user's original checkout.
