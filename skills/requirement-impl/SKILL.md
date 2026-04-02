---
name: requirement-impl
description: Use when the user provides a local requirement file, pasted spec, screenshots, or product notes and wants Codex to translate the requirement into concrete repository changes, implement them directly, validate the result, and summarize any ambiguity or residual risk. Also use when Codex should follow a repeatable workflow for turning requirements into code in this repo.
---

# Requirement Implementation

Use this skill to turn product requirements into code changes without stopping at analysis.

Read [rabby-mobile.md](./references/rabby-mobile.md) before choosing validation commands or verifying analytics behavior in this repo.

## Workflow

1. Read the smallest requirement source that fully covers the task.
   Local files, pasted text, and attached screenshots are enough. Do not broaden scope unless the requirement is incomplete.
2. Reduce the requirement into a compact checklist before editing.
   Capture:
   - user-visible behavior
   - trigger timing
   - labels, copy, or analytics names that must match exactly
   - constraints and explicit non-goals
3. Search the repo before deciding the implementation path.
   Find the current owner for the screen, component, hook, store, service, analytics helper, and persistence path. Do not infer file ownership from the requirement alone.
4. Implement directly with the smallest safe change.
   Preserve existing feature flags, platform branches, persisted state, and naming conventions unless the requirement explicitly changes them.
5. Validate narrowly first.
   Start with the smallest check that proves the touched path works. Expand only when the change surface demands broader verification.
6. Report outcome and ambiguity.
   State what changed, what was verified, and any remaining ambiguity from the requirement source.

## Execution Rules

- Treat the requirement as product intent, not as proof that the current code already matches it.
- Check edge cases before coding: platform differences, lifecycle timing, async refreshes, stale cache, dedupe rules, permissions, analytics, and persisted settings.
- For screenshot-driven tasks, use the screenshot to confirm intent and labels, then implement against existing UI structure and code ownership.
- If the requirement is partially ambiguous, implement the smallest defensible interpretation and call it out in the final summary.
- If the task is clearly an implementation request, do the work. Do not stop at a plan unless the user explicitly asks for planning only.

## Validation

- Prefer targeted `eslint`, typecheck, or focused test commands over broad repo validation.
- For analytics changes, verify both the event trigger path in code and the emitted GA4 shape in Firebase DebugView when possible.
- If verification is blocked by environment limits, say exactly what was checked and what remains manual.

