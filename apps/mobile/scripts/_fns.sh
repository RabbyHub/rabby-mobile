#!/bin/sh

mobile_git_repo_root() {
  git_root=$(git rev-parse --show-toplevel 2>/dev/null) || true
  if [ -n "$git_root" ]; then
    printf '%s\n' "$git_root"
    return 0
  fi

  script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  (cd "$script_dir/../../.." >/dev/null 2>&1 && pwd)
}

mobile_valid_release_tag() {
  printf '%s\n' "$1" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'
}

mobile_release_version_gt() {
  left="$1"
  right="$2"

  left_major=$(printf '%s\n' "$left" | cut -d. -f1)
  left_minor=$(printf '%s\n' "$left" | cut -d. -f2)
  left_patch=$(printf '%s\n' "$left" | cut -d. -f3)

  right_major=$(printf '%s\n' "$right" | cut -d. -f1)
  right_minor=$(printf '%s\n' "$right" | cut -d. -f2)
  right_patch=$(printf '%s\n' "$right" | cut -d. -f3)

  if [ "$left_major" -gt "$right_major" ]; then
    return 0
  fi
  if [ "$left_major" -lt "$right_major" ]; then
    return 1
  fi

  if [ "$left_minor" -gt "$right_minor" ]; then
    return 0
  fi
  if [ "$left_minor" -lt "$right_minor" ]; then
    return 1
  fi

  if [ "$left_patch" -gt "$right_patch" ]; then
    return 0
  fi

  return 1
}

mobile_latest_release_tag() {
  repo_root="$1"
  latest_tag=""

  for tag in $(git -C "$repo_root" tag); do
    if ! mobile_valid_release_tag "$tag"; then
      continue
    fi

    if [ -z "$latest_tag" ] || mobile_release_version_gt "${tag#v}" "${latest_tag#v}"; then
      latest_tag="$tag"
    fi
  done

  if [ -n "$latest_tag" ]; then
    printf '%s\n' "$latest_tag"
  fi
}

mobile_find_publish_commit_on_develop() {
  repo_root="$1"
  version="$2"

  git -C "$repo_root" log origin/develop --first-parent --format='%H%x09%s' |
    while IFS="$(printf '\t')" read -r commit subject; do
      case "$subject" in
        "build: publish $version"|"build: publish $version "*|"Publish/$version"|"Publish/$version "*)
          printf '%s\t%s\n' "$commit" "$subject"
          break
          ;;
      esac
    done
}

mobile_should_skip_publish_tag_sync() {
  case "${RABBY_MOBILE_SKIP_PUBLISH_TAG_SYNC:-}" in
    true|1|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

check_publish_tag() {
  requested_tag="$1"
  if [ -z "$requested_tag" ]; then
    echo "Usage: check_publish_tag vX.Y.Z"
    return 1
  fi

  if ! mobile_valid_release_tag "$requested_tag"; then
    echo "Invalid tag format: $requested_tag"
    echo "Expected format: vX.Y.Z"
    return 1
  fi

  repo_root=$(mobile_git_repo_root)
  if [ -z "$repo_root" ]; then
    echo "Failed to locate git repository root"
    return 1
  fi

  if ! mobile_should_skip_publish_tag_sync; then
    if ! git -C "$repo_root" fetch --quiet origin develop --tags; then
      echo "Failed to sync origin/develop or tags"
      return 1
    fi
  fi

  version="${requested_tag#v}"
  latest_tag=$(mobile_latest_release_tag "$repo_root")

  if git -C "$repo_root" rev-parse -q --verify "refs/tags/$requested_tag" >/dev/null 2>&1; then
    tag_commit=$(git -C "$repo_root" rev-list -n 1 "$requested_tag")
    tag_subject=$(git -C "$repo_root" show -s --format='%s' "$requested_tag")

    echo "tag_exists=true"
    echo "tag=$requested_tag"
    echo "commit=$tag_commit"
    echo "subject=$tag_subject"
    return 0
  fi

  publish_match=$(mobile_find_publish_commit_on_develop "$repo_root" "$version")
  publish_commit=$(printf '%s\n' "$publish_match" | cut -f1)
  publish_subject=$(printf '%s\n' "$publish_match" | cut -f2-)

  echo "tag_exists=false"
  echo "tag=$requested_tag"
  if [ -n "$latest_tag" ]; then
    echo "latest_tag=$latest_tag"
  fi

  if [ -n "$publish_commit" ]; then
    echo "matched_publish_commit=$publish_commit"
    echo "matched_publish_subject=$publish_subject"
    echo "suggested_command=git tag $requested_tag $publish_commit"
    return 0
  fi

  if [ -n "$latest_tag" ] && mobile_release_version_gt "$version" "${latest_tag#v}"; then
    echo "status=unreasonable_input"
    echo "reason=no merged publish PR found on origin/develop, and $requested_tag is newer than latest tag $latest_tag"
    return 2
  fi

  echo "status=no_publish_match"
  echo "reason=no merged publish PR found on origin/develop"
  return 0
}

func_to_exec=$1

if [ ! -z "$func_to_exec" ]; then
  case "$func_to_exec" in
    "--source-only")
      ;;
    "check_publish_tag")
      shift
      check_publish_tag "$@"
      ;;
  esac
fi
