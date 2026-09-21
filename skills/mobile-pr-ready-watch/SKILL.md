---
name: mobile-pr-ready-watch
description: Mark a Rabby Mobile GitHub PR ready for review, inspect thread-aware review state, watch for new review feedback, implement addressed fixes, and resolve review threads after fixes are pushed. Use when Codex is asked to make a mobile PR ready, keep observing a PR, handle GitHub review comments, or resolve addressed PR review threads.
---

# Mobile PR Ready Watch

Use this skill for the repeatable "make the PR ready, then watch and handle review feedback" workflow.

Default watch window: 15 minutes. Poll every 2-3 minutes unless the user gives a different duration.

## Rules

- Work from the Rabby Mobile repository checkout that owns the PR.
- Use the authenticated GitHub CLI or the repository's configured GitHub tooling.
- Do not print tokens, GitHub auth internals, or credential files.
- Do not use `git ls-remote`, PR refs, or merge refs as a substitute for review inspection. Review comments require GitHub API access.
- Do not merge the PR unless the user explicitly asks.
- Do not resolve a thread until the issue is fixed, confirmed obsolete, or explicitly accepted as not actionable.

## Opening Checks

Identify the PR from the current branch unless the user gives a PR number or URL:

```bash
gh pr view --json number,title,url,headRefName,baseRefName,state,isDraft,reviewDecision,latestReviews,reviewRequests,mergeStateStatus
git status --short --branch
```

If the PR is draft and the request includes making it ready, mark it ready:

```bash
gh pr ready <pr-number>
```

If GitHub auth is missing or invalid, stop and report the blocker. Do not start a timed watch without review-thread access.

## Review Inspection

Fetch review threads through GraphQL so `isResolved`, `isOutdated`, line anchors, and threaded comments are visible:

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
OWNER="${REPO%/*}"
NAME="${REPO#*/}"
NUMBER="$(gh pr view --json number -q .number)"

gh api graphql \
  -f owner="$OWNER" \
  -f name="$NAME" \
  -F number="$NUMBER" \
  -f query='query($owner:String!,$name:String!,$number:Int!){ repository(owner:$owner,name:$name){ pullRequest(number:$number){ id number isDraft reviewDecision mergeStateStatus latestReviews(first:20){nodes{id state body author{login} submittedAt commit{oid}}} reviewThreads(first:100){nodes{id isResolved isOutdated path line originalLine comments(first:20){nodes{id body author{login} createdAt url pullRequestReview{id state commit{oid}}}}}}}} }'
```

Classify every unresolved thread:

- `needs-fix`: the reviewer points out a real bug, regression, missing guard, missing test, or risky behavior.
- `already-fixed`: current code already addresses the comment.
- `obsolete-outdated`: the thread is outdated and the current code path no longer has the problem.
- `needs-discussion`: the comment conflicts with an explicit product decision or is too broad for the current iteration.

Surface `needs-discussion` items before editing. For `needs-fix`, implement the smallest focused fix.

## Handling Feedback

For each actionable review thread:

1. Read the referenced file and nearby code before editing.
2. Patch only the reviewed issue and directly related tests.
3. Preserve business semantics unless the user explicitly approves a behavior change.
4. Run the narrowest meaningful verification first; broaden when the change touches shared behavior.
5. Commit and push the fix before resolving the thread.

Resolve addressed review threads with GraphQL:

```bash
gh api graphql \
  -f threadId="<thread-id>" \
  -f query='mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}'
```

After resolving, re-fetch review threads and confirm the unresolved count.

## Watch Loop

At each poll:

1. Refresh PR metadata and review threads.
2. Handle new unresolved feedback using the classification rules above.
3. If code changes are made, verify, commit, push, then resolve only proven-addressed threads.
4. Continue until the watch window ends or the user stops the watch.

When entering a long watch, give a short status note:

```text
PR is ready. I will watch it for <N> minutes and handle new review feedback as it appears.
```

## Final Report

Report:

- PR number and URL
- whether it was already ready or changed from draft
- review threads fixed and resolved
- unresolved threads left open and why
- commits pushed during the watch
- verification that passed or could not be run
