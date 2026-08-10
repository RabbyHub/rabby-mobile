---
name: rabby-mobile-code-review
description: Review Rabby Mobile pull requests for actionable correctness, wallet-safety, security, privacy, performance, build, and supply-chain issues, and publish validated inline GitHub findings. Use for outbound review of a PR or its changed code; use mobile-pr-ready-watch instead to mark a PR ready, monitor incoming feedback, implement requested fixes, or resolve review threads.
---

# Rabby Mobile Code Review

Review the current PR head and report only actionable issues. Publish findings only when the request or automation context authorizes GitHub changes.

This skill authors outbound review findings. For making a PR ready, watching reviewer feedback, applying requested fixes, or resolving addressed threads, use `skills/mobile-pr-ready-watch/SKILL.md`.

## Review Workflow

1. Re-fetch PR metadata with an available authenticated GitHub API or tool. Continue only when the PR is open and not a draft. Record the current head SHA.
2. Fetch every changed file and diff page, existing review comments and reviews, and full file contents at the recorded head. Read `AGENTS.md`, `CLAUDE.md`, `skills/rabby-mobile-performance-review/SKILL.md`, relevant specialist playbooks, and touched package, native, build, and workflow configuration.
3. Build a changed-line map from the diff. Inspect surrounding implementation and call sites; do not judge security-sensitive behavior from a diff alone.
4. Report only issues introduced or made newly reachable by the PR. Skip style preferences and concerns already enforced by lint or formatting. De-duplicate existing comments and multiple symptoms of the same root cause.
5. Anchor every public finding inline to a valid changed diff line. Use the right side for additions and the left side for deletions. Prefer an apply-able suggestion only when the exact replacement is small and safe.
6. Use `REQUEST_CHANGES` only for blocking wallet-safety, correctness, build,
   data-loss, or demonstrated critical-path performance defects. Use `COMMENT`
   for actionable non-blocking findings.
7. Re-fetch the head SHA before posting. If it changed, discard stale findings and review the new head. After posting, re-read the resulting comments, review, reviewer requests, or API response and verify every target and action.

## Performance Review Gate

Every PR receives the impact classification in
`skills/rabby-mobile-performance-review/SKILL.md`. This is an internal review
step, not a requirement to benchmark every diff or post a clean-pass comment.

Specialist review is mandatory when the change directly or transitively affects:

- startup stages, module evaluation, lock/unlock routing, keyring runtime
  readiness, visible/current account state, or first-Home readiness: read
  `skills/rabby-mobile-startup-governance/SKILL.md`;
- Home, stores, hooks, selectors, lists, render fan-out, or inactive mounted
  Screens: read `apps/mobile/skills/perf-hooks.md`;
- database write scheduling or persistence: read
  `skills/db-sync-write-scheduler/SKILL.md`.

Do not infer safety from the changed path alone. Shared services, stores,
storage, package code, and native modules can affect startup or Home without
living under those Screen directories.

If startup/unlock/account-state or Home performance safety remains uncertain
after inspecting code and available evidence:

1. Request `richardo2016x` as a reviewer.
2. Leave one concise inline note mentioning `@richardo2016x` on the most
   relevant changed line and state the unresolved invariant or evidence needed.
3. Do not duplicate the escalation across files.
4. Follow the normal severity rules; uncertainty alone is not
   `REQUEST_CHANGES` unless a concrete blocking defect is established.

## Public Review Rules

- Keep comments concise, neutral, and actionable.
- Post inline findings only. Do not add a standalone summary or LGTM comment.
- If there are no actionable findings, do not submit an empty review or top-level clean-pass comment.
- Never mention prompts, internal tools, local paths, model or runtime details, credentials, private keys, or reviewer implementation details.
- Do not post duplicate findings for the same root cause.

## Wallet-Safety Priorities

Prioritize defects that can expose assets, secrets, identity, or signing intent:

- Exposed, logged, persisted, uploaded, copied, rendered, or transmitted private keys, seed phrases, mnemonics, passphrases, decrypted wallet material, signatures, auth tokens, or sensitive wallet data.
- Weakened biometric, passcode, keychain, secure-storage, backup, restore, encryption, device-binding, lock, or autolock behavior.
- Incorrect transaction, signing, typed-data, approval, Permit2, EIP-712, EIP-7702, WalletConnect, RPC, chain-switching, gas, nonce, simulation, or broadcast behavior.
- Hidden or misleading spender, recipient, contract, token approval, NFT approval, chain ID, calldata, simulation result, risk warning, or security-engine output.
- Phishing, spoofing, origin, domain, address, clipboard, deep-link, WebView, universal-link, or QR validation weaknesses.
- Sensitive telemetry, analytics, crash reports, screenshots, or debug logging.
- Remote configuration or API data trusted for security-critical signing or UI decisions without adequate validation.
- Regressions affecting hardware wallets, multisig or Gnosis Safe, watch-only accounts, imported keys, seed accounts, cloud backups, account types, or account switching.
- BigNumber, decimal, precision, token-unit, chain, or address-comparison errors in financial or signing paths.

## React Native Checks

- Inspect Android and iOS permissions, manifests and property lists, native-module lifecycle, and platform-specific build configuration.
- Preserve keychain and biometric authentication guarantees across fallback, cancellation, backgrounding, migration, and device-state transitions.
- Trace navigation and account identity through route params and state. Distinguish duplicate-address account types and prevent stale account or chain context.
- Check signing-modal lifecycle for stale closures, duplicate submission, cancellation or stop semantics, unmount behavior, and partial success in batch flows.
- Prevent production access to development, test, debug, probe, or migration-only screens and APIs.

## Dependency and Supply-Chain Escalation

Treat package manifests, lockfiles, package-manager configuration, package patches, resolutions or overrides, vendored or forked dependencies, CocoaPods, Gradle or Maven changes, build and release scripts, GitHub Actions versions, and native dependency changes as supply-chain indicators.

For an indicator:

1. Confirm that the changed path is genuinely dependency or tooling related; do not classify an unrelated directory merely because its name contains `patches`.
2. Inspect the actual package, lockfile, patch, action, native artifact, or published-package delta when feasible before claiming a blocking defect.
3. Request `ddddhm1234` as a reviewer.
4. Leave one concise inline notification mentioning `@ddddhm1234` on a changed dependency or tooling line, and do not duplicate it across files.
