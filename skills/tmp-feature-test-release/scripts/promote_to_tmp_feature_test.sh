#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '[tmp-feature-test-release] %s\n' "$*" >&2
}

die() {
  printf '[tmp-feature-test-release] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Promote committed changes onto a Friday tmp branch and optionally dispatch Feature Test.

Usage:
  promote_to_tmp_feature_test.sh [options]

Options:
  --commit <rev>           Commit to cherry-pick. Repeat to apply multiple commits.
                           Defaults to HEAD when omitted.
  --tmp-branch <tmp/*>     Override the target tmp branch.
  --remote <name>          Git remote to push to. Default: origin
  --base-branch <name>     Base branch used when tmp branch must be created. Default: develop
  --machine <name>         Feature Test macOS runner: mobile or mobile-local. Default: mobile-local
  --pod-cache <bool>       Set RABBY_MOBILE_POD_USE_CACHE. Default: true
  --nm-cache <bool>        Set RABBY_MOBILE_NM_USE_CACHE. Default: true
  --gradle-cache <bool>    Set RABBY_MOBILE_GRADLE_USE_CACHE. Default: true
  --really-upload <bool>   Set REALLY_UPLOAD. Default: true
  --skip-dispatch          Push the tmp branch update without dispatching Feature Test.
  --keep-worktree          Keep the temporary worktree after success.
  --dry-run                Print the resolved plan without changing git or GitHub state.
  -h, --help               Show this help text.
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_bool() {
  case "$2" in
    true|false) ;;
    *) die "$1 must be true or false, got: $2" ;;
  esac
}

next_friday_tmp_branch() {
  python3 - <<'PY'
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
days_until_friday = (4 - today.weekday()) % 7
target = today + timedelta(days=days_until_friday)
print(f"tmp/{target:%Y%m%d}")
PY
}

find_dispatched_run_url() {
  local branch="$1"
  local sha="$2"
  local workflow="$3"

  (
    cd "$REPO_ROOT"
    gh run list \
      --workflow "$workflow" \
      --branch "$branch" \
      --limit 10 \
      --json databaseId,event,headBranch,headSha,status,conclusion,url,createdAt
  ) |
    python3 - "$branch" "$sha" <<'PY'
import json
import sys

branch = sys.argv[1]
sha = sys.argv[2]
runs = json.load(sys.stdin)

for run in runs:
    if run.get("event") != "workflow_dispatch":
        continue
    if run.get("headBranch") != branch:
        continue
    if run.get("headSha") != sha:
        continue
    print(run.get("url", ""))
    break
PY
}

COMMITS=()
REMOTE=origin
BASE_BRANCH=develop
TMP_BRANCH=
MACHINE=mobile-local
POD_CACHE=true
NM_CACHE=true
GRADLE_CACHE=true
REALLY_UPLOAD=true
SKIP_DISPATCH=false
KEEP_WORKTREE=false
DRY_RUN=false
WORKFLOW_FILE=.github/workflows/feature_test.yml

while [ "$#" -gt 0 ]; do
  case "$1" in
    --commit)
      [ "$#" -ge 2 ] || die "--commit requires a value"
      COMMITS+=("$2")
      shift 2
      ;;
    --tmp-branch)
      [ "$#" -ge 2 ] || die "--tmp-branch requires a value"
      TMP_BRANCH="$2"
      shift 2
      ;;
    --remote)
      [ "$#" -ge 2 ] || die "--remote requires a value"
      REMOTE="$2"
      shift 2
      ;;
    --base-branch)
      [ "$#" -ge 2 ] || die "--base-branch requires a value"
      BASE_BRANCH="$2"
      shift 2
      ;;
    --machine)
      [ "$#" -ge 2 ] || die "--machine requires a value"
      MACHINE="$2"
      shift 2
      ;;
    --pod-cache)
      [ "$#" -ge 2 ] || die "--pod-cache requires a value"
      POD_CACHE="$2"
      shift 2
      ;;
    --nm-cache)
      [ "$#" -ge 2 ] || die "--nm-cache requires a value"
      NM_CACHE="$2"
      shift 2
      ;;
    --gradle-cache)
      [ "$#" -ge 2 ] || die "--gradle-cache requires a value"
      GRADLE_CACHE="$2"
      shift 2
      ;;
    --really-upload)
      [ "$#" -ge 2 ] || die "--really-upload requires a value"
      REALLY_UPLOAD="$2"
      shift 2
      ;;
    --skip-dispatch)
      SKIP_DISPATCH=true
      shift
      ;;
    --keep-worktree)
      KEEP_WORKTREE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

require_cmd git
require_cmd gh
require_cmd python3

case "$MACHINE" in
  mobile|mobile-local) ;;
  *) die "--machine must be mobile or mobile-local, got: $MACHINE" ;;
esac

require_bool --pod-cache "$POD_CACHE"
require_bool --nm-cache "$NM_CACHE"
require_bool --gradle-cache "$GRADLE_CACHE"
require_bool --really-upload "$REALLY_UPLOAD"

if [ -z "$TMP_BRANCH" ]; then
  TMP_BRANCH="$(next_friday_tmp_branch)"
fi

case "$TMP_BRANCH" in
  tmp/*) ;;
  *) die "--tmp-branch must start with tmp/, got: $TMP_BRANCH" ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "Run this script inside a git repository"

if [ "${#COMMITS[@]}" -eq 0 ]; then
  COMMITS=(HEAD)
fi

RESOLVED_COMMITS=()
for rev in "${COMMITS[@]}"; do
  resolved="$(git -C "$REPO_ROOT" rev-parse --verify "${rev}^{commit}" 2>/dev/null)" ||
    die "Unable to resolve commit: $rev"
  RESOLVED_COMMITS+=("$resolved")
done

log "Repository root: $REPO_ROOT"
log "Target tmp branch: $TMP_BRANCH"
log "Commits to cherry-pick: ${RESOLVED_COMMITS[*]}"

TMP_EXISTS=false
if git -C "$REPO_ROOT" ls-remote --exit-code --heads "$REMOTE" "$TMP_BRANCH" >/dev/null 2>&1; then
  TMP_EXISTS=true
fi

git -C "$REPO_ROOT" fetch --quiet "$REMOTE" "$BASE_BRANCH" --no-tags

BASE_SHA="$(git -C "$REPO_ROOT" rev-parse "${REMOTE}/${BASE_BRANCH}^{commit}")"

if [ "$DRY_RUN" = true ]; then
  printf 'dry_run=true\n'
  printf 'repo_root=%s\n' "$REPO_ROOT"
  printf 'tmp_branch=%s\n' "$TMP_BRANCH"
  printf 'tmp_branch_exists=%s\n' "$TMP_EXISTS"
  printf 'base_branch=%s\n' "$BASE_BRANCH"
  printf 'base_sha=%s\n' "$BASE_SHA"
  printf 'commits=%s\n' "${RESOLVED_COMMITS[*]}"
  printf 'machine=%s\n' "$MACHINE"
  printf 'pod_cache=%s\n' "$POD_CACHE"
  printf 'nm_cache=%s\n' "$NM_CACHE"
  printf 'gradle_cache=%s\n' "$GRADLE_CACHE"
  printf 'really_upload=%s\n' "$REALLY_UPLOAD"
  printf 'skip_dispatch=%s\n' "$SKIP_DISPATCH"
  exit 0
fi

if [ "$TMP_EXISTS" = false ]; then
  log "Creating ${TMP_BRANCH} from ${REMOTE}/${BASE_BRANCH} (${BASE_SHA})"
  git -C "$REPO_ROOT" push --quiet "$REMOTE" "${BASE_SHA}:refs/heads/${TMP_BRANCH}"
fi

git -C "$REPO_ROOT" fetch --quiet "$REMOTE" "$TMP_BRANCH" --no-tags

SAFE_BRANCH_NAME="${TMP_BRANCH//\//-}"
LOCAL_BRANCH="codex-${SAFE_BRANCH_NAME}-$(date +%s)"
WORKTREE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/${SAFE_BRANCH_NAME}.XXXXXX")"

cleanup() {
  local exit_code=$?
  trap - EXIT

  if [ "$exit_code" -eq 0 ] && [ "$KEEP_WORKTREE" != true ]; then
    git -C "$REPO_ROOT" worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
    git -C "$REPO_ROOT" branch -D "$LOCAL_BRANCH" >/dev/null 2>&1 || true
    exit 0
  fi

  if [ "$exit_code" -ne 0 ]; then
    log "Keeping worktree for inspection: $WORKTREE_DIR"
  else
    log "Keeping worktree by request: $WORKTREE_DIR"
  fi

  exit "$exit_code"
}
trap cleanup EXIT

log "Creating isolated worktree: $WORKTREE_DIR"
git -C "$REPO_ROOT" worktree add -b "$LOCAL_BRANCH" "$WORKTREE_DIR" "${REMOTE}/${TMP_BRANCH}" >/dev/null

log "Cherry-picking commits onto ${TMP_BRANCH}"
git -C "$WORKTREE_DIR" cherry-pick "${RESOLVED_COMMITS[@]}"

log "Pushing updated tmp branch"
git -C "$WORKTREE_DIR" push "$REMOTE" "HEAD:refs/heads/${TMP_BRANCH}" >/dev/null

PUSHED_SHA="$(git -C "$WORKTREE_DIR" rev-parse HEAD)"
RUN_URL=

if [ "$SKIP_DISPATCH" = false ]; then
  log "Dispatching Feature Test workflow"
  (
    cd "$REPO_ROOT"
    gh workflow run "$WORKFLOW_FILE" \
      --ref "$TMP_BRANCH" \
      -f macos_machine_location="$MACHINE" \
      -f RABBY_MOBILE_POD_USE_CACHE="$POD_CACHE" \
      -f RABBY_MOBILE_NM_USE_CACHE="$NM_CACHE" \
      -f RABBY_MOBILE_GRADLE_USE_CACHE="$GRADLE_CACHE" \
      -f REALLY_UPLOAD="$REALLY_UPLOAD" >/dev/null
  )

  sleep 3
  RUN_URL="$(find_dispatched_run_url "$TMP_BRANCH" "$PUSHED_SHA" "$WORKFLOW_FILE")"
fi

printf 'tmp_branch=%s\n' "$TMP_BRANCH"
printf 'pushed_sha=%s\n' "$PUSHED_SHA"

if [ -n "$RUN_URL" ]; then
  printf 'feature_test_run_url=%s\n' "$RUN_URL"
fi
