#!/bin/bash

set -euo pipefail

script_dir="$( cd "$( dirname "$0" )" && pwd )"
project_dir=$(dirname "$script_dir")

if [ "${RABBY_MOBILE_GOOGLE_PLAY_LOGIN_SHELL_REEXEC:-}" != "1" ]; then
  export RABBY_MOBILE_GOOGLE_PLAY_LOGIN_SHELL_REEXEC=1
  exec_cmd="cd $(printf '%q' "$PWD") && "
  exec_cmd="$exec_cmd$(printf '%q ' "$0" "$@")"
  exec bash -lc "$exec_cmd"
fi

. "$script_dir/fns.sh" --source-only

normalize_proxy_env() {
  if [ -n "${HTTP_PROXY:-}" ] && [ -z "${http_proxy:-}" ]; then
    export http_proxy="$HTTP_PROXY"
  fi
  if [ -n "${http_proxy:-}" ] && [ -z "${HTTP_PROXY:-}" ]; then
    export HTTP_PROXY="$http_proxy"
  fi

  if [ -n "${HTTPS_PROXY:-}" ] && [ -z "${https_proxy:-}" ]; then
    export https_proxy="$HTTPS_PROXY"
  fi
  if [ -n "${https_proxy:-}" ] && [ -z "${HTTPS_PROXY:-}" ]; then
    export HTTPS_PROXY="$https_proxy"
  fi

  if [ -n "${ALL_PROXY:-}" ] && [ -z "${all_proxy:-}" ]; then
    export all_proxy="$ALL_PROXY"
  fi
  if [ -n "${all_proxy:-}" ] && [ -z "${ALL_PROXY:-}" ]; then
    export ALL_PROXY="$all_proxy"
  fi

  if [ -n "${NO_PROXY:-}" ] && [ -z "${no_proxy:-}" ]; then
    export no_proxy="$NO_PROXY"
  fi
  if [ -n "${no_proxy:-}" ] && [ -z "${NO_PROXY:-}" ]; then
    export NO_PROXY="$no_proxy"
  fi
}

usage() {
  cat <<'EOF'
Usage:
  bash ./scripts/google-play.sh <command> [flags]

Commands:
  upload-internal-track

Flags:
  --package-name <name>                  Google Play package name
                                         Default: com.debank.rabbymobile
  --bundle-path <path>                   Path to Android App Bundle (.aab)
                                         Default:
                                         android/app/build/outputs/bundle/release/app-release.aab
  --draft                                Upload as a draft release without serving it
                                         on the internal track
  --release-status <status>              Google Play release status
                                         Supported: completed, draft
                                         Default: completed
  --release-name <name>                  Optional release name shown in Play Console
  --release-notes-file <path>            Optional release notes text file
  --release-notes-language <tag>         Release notes language tag
                                         Default: en-US
  --service-account-file <path>          Path to service account JSON
  --service-account-json <json>          Raw service account JSON
  --service-account-json-base64 <base64> Base64 encoded service account JSON
  --google-application-credentials <path>
                                         Alias of GOOGLE_APPLICATION_CREDENTIALS
  --http-proxy <url>                     Set HTTP_PROXY for this command
  --https-proxy <url>                    Set HTTPS_PROXY for this command
  --all-proxy <url>                      Set ALL_PROXY for this command
  --no-proxy <value>                     Set NO_PROXY for this command
  -h, --help                             Show help

Examples:
  bash ./scripts/google-play.sh upload-internal-track

  bash ./scripts/google-play.sh upload-internal-track \
    --bundle-path ./android/app/build/outputs/bundle/release/app-release.aab
EOF
}

require_flag() {
  local flag_name="$1"
  local flag_value="$2"

  if [ -z "$flag_value" ]; then
    echo "Missing required flag: $flag_name" >&2
    exit 1
  fi
}

command_name="${1:-}"
if [ -z "$command_name" ]; then
  usage
  exit 1
fi
shift || true

normalize_proxy_env

package_name=""
bundle_path=""
release_status=""
release_name=""
release_notes_file=""
release_notes_language=""

while [ $# -gt 0 ]; do
  case "$1" in
    --package-name)
      package_name="${2:-}"
      shift 2
      ;;
    --bundle-path)
      bundle_path="${2:-}"
      shift 2
      ;;
    --draft)
      release_status="draft"
      shift 1
      ;;
    --release-status)
      release_status="${2:-}"
      shift 2
      ;;
    --release-name)
      release_name="${2:-}"
      shift 2
      ;;
    --release-notes-file)
      release_notes_file="${2:-}"
      shift 2
      ;;
    --release-notes-language)
      release_notes_language="${2:-}"
      shift 2
      ;;
    --service-account-file)
      export RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_FILE="${2:-}"
      shift 2
      ;;
    --service-account-json)
      export RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="${2:-}"
      shift 2
      ;;
    --service-account-json-base64)
      export RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64="${2:-}"
      shift 2
      ;;
    --google-application-credentials)
      export GOOGLE_APPLICATION_CREDENTIALS="${2:-}"
      shift 2
      ;;
    --http-proxy)
      export HTTP_PROXY="${2:-}"
      export http_proxy="${2:-}"
      shift 2
      ;;
    --https-proxy)
      export HTTPS_PROXY="${2:-}"
      export https_proxy="${2:-}"
      shift 2
      ;;
    --all-proxy)
      export ALL_PROXY="${2:-}"
      export all_proxy="${2:-}"
      shift 2
      ;;
    --no-proxy)
      export NO_PROXY="${2:-}"
      export no_proxy="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

normalize_proxy_env

case "$command_name" in
  upload-internal-track)
    google_play_upload_bundle_to_internal_track \
      "$bundle_path" \
      "$package_name" \
      "$release_status" \
      "$release_name" \
      "$release_notes_file" \
      "$release_notes_language"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $command_name" >&2
    usage
    exit 1
    ;;
esac
