#!/bin/sh

UNIX_TYPE=$(uname -s)
RABBY_HOST_OS=`uname`

case $RABBY_HOST_OS in
  MINGW*|CYGWIN*|MSYS_NT*)
    RABBY_HOST_OS="Windows"
    ;;
esac

case $OSTYPE in
  msys*|cygwin*)
    RABBY_HOST_OS="Windows"
    ;;
esac

prepare_env() {
  export script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
  export project_dir=$script_dir
}

resolve_mobile_project_dir() {
  if [ -n "${project_dir:-}" ] && [ -d "$project_dir" ]; then
    printf '%s\n' "$project_dir"
    return 0
  fi

  if [ -n "${script_dir:-}" ] && [ -d "$script_dir" ]; then
    dirname "$script_dir"
    return 0
  fi

  pwd
}

resolve_mobile_build_env() {
  case "${CONFIGURATION:-}" in
    Release)
      echo "production"
      return 0
      ;;
    Regression)
      echo "regression"
      return 0
      ;;
    Debug)
      echo "debug"
      return 0
      ;;
  esac

  case "${RABBY_MOBILE_BUILD_ENV:-}" in
    production|regression|debug)
      echo "$RABBY_MOBILE_BUILD_ENV"
      return 0
      ;;
  esac

  case "${buildchannel:-}" in
    appstore|selfhost)
      echo "production"
      return 0
      ;;
    selfhost-reg)
      echo "regression"
      return 0
      ;;
  esac

  return 1
}

list_candidate_env_files() {
  local current_project_dir
  current_project_dir=$(resolve_mobile_project_dir)
  local build_env
  build_env=$(resolve_mobile_build_env 2>/dev/null || true)

  case "$build_env" in
    production)
      printf '%s\n' \
        "$current_project_dir/.env.production" \
        "$current_project_dir/.env"
      ;;
    regression)
      printf '%s\n' \
        "$current_project_dir/.env.regression" \
        "$current_project_dir/.env.local" \
        "$current_project_dir/.env"
      ;;
    debug)
      printf '%s\n' \
        "$current_project_dir/.env.local" \
        "$current_project_dir/.env"
      ;;
    *)
      printf '%s\n' \
        "$current_project_dir/.env.local" \
        "$current_project_dir/.env"
      ;;
  esac
}

read_env_var_from_file() {
  local env_file="$1"
  local env_key="$2"

  [ -f "$env_file" ] || return 1

  awk -v key="$env_key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line = $0
      sub(/\r$/, "", line)
      pos = index(line, "=")
      if (pos == 0) next

      current_key = substr(line, 1, pos - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_key)
      if (current_key != key) next

      value = substr(line, pos + 1)
      sub(/[[:space:]]*#.*$/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)

      first = substr(value, 1, 1)
      last = substr(value, length(value), 1)
      if ((first == "\"" && last == "\"") || (first == "'"'"'" && last == "'"'"'")) {
        value = substr(value, 2, length(value) - 2)
      }

      print value
      exit
    }
  ' "$env_file"
}

load_env_var_from_candidate_files() {
  local env_key="$1"
  local current_value
  eval "current_value=\${$env_key:-}"

  if [ -n "$current_value" ]; then
    return 0
  fi

  local env_file value
  while IFS= read -r env_file; do
    [ -f "$env_file" ] || continue
    value=$(read_env_var_from_file "$env_file" "$env_key")
    if [ -n "$value" ]; then
      export "$env_key=$value"
      echo "[RabbyMobileBuild] loaded $env_key from $env_file"
      return 0
    fi
  done <<EOF
$(list_candidate_env_files)
EOF

  return 1
}

list_google_play_candidate_env_files() {
  local current_project_dir
  current_project_dir=$(resolve_mobile_project_dir)

  printf '%s\n' \
    "$current_project_dir/.env.production" \
    "$current_project_dir/.env.local" \
    "$current_project_dir/.env"
}

load_google_play_env_var_from_candidate_files() {
  local env_key="$1"
  local current_value
  eval "current_value=\${$env_key:-}"

  if [ -n "$current_value" ]; then
    return 0
  fi

  local env_file value
  while IFS= read -r env_file; do
    [ -f "$env_file" ] || continue
    value=$(read_env_var_from_file "$env_file" "$env_key")
    if [ -n "$value" ]; then
      export "$env_key=$value"
      echo "[RabbyMobileBuild] loaded $env_key from $env_file"
      return 0
    fi
  done <<EOF
$(list_google_play_candidate_env_files)
EOF

  return 1
}

check_build_params() {
  load_env_var_from_candidate_files RABBY_MOBILE_KR_PWD
  load_env_var_from_candidate_files RABBY_MOBILE_CODE

  if [ -z $RABBY_MOBILE_KR_PWD ]; then
    echo "RABBY_MOBILE_KR_PWD is not set"
    exit 1;
  fi

  if [ -z $RABBY_MOBILE_CODE ]; then
    echo "RABBY_MOBILE_CODE is not set"
    exit 1;
  fi
}

resolve_ios_info_plist_path() {
  local target_path="$1"

  if [ -z "$target_path" ]; then
    echo "Usage: sh ./scripts/fns.sh print_ios_rabbit_code <path-to-.xcarchive-or-.app>" >&2
    return 1
  fi

  if [ -d "$target_path" ] && [ "${target_path##*.}" = "app" ]; then
    local app_info_plist="$target_path/Info.plist"
    if [ -f "$app_info_plist" ]; then
      printf '%s\n' "$app_info_plist"
      return 0
    fi
  fi

  if [ -d "$target_path" ] && [ "${target_path##*.}" = "xcarchive" ]; then
    local archive_info_plist
    archive_info_plist=$(find "$target_path/Products/Applications" -maxdepth 2 -path '*.app/Info.plist' | head -n 1)
    if [ -n "$archive_info_plist" ] && [ -f "$archive_info_plist" ]; then
      printf '%s\n' "$archive_info_plist"
      return 0
    fi
  fi

  echo "Could not resolve Info.plist from: $target_path" >&2
  return 1
}

print_ios_rabbit_code() {
  local target_path="$1"
  local info_plist
  info_plist=$(resolve_ios_info_plist_path "$target_path") || return 1

  /usr/libexec/PlistBuddy -c 'Print :rabbit_code' "$info_plist"
}

prepare_google_play_api_env() {
  load_google_play_env_var_from_candidate_files RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64
  load_google_play_env_var_from_candidate_files RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
  load_google_play_env_var_from_candidate_files RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_FILE
  load_google_play_env_var_from_candidate_files GOOGLE_APPLICATION_CREDENTIALS
  load_google_play_env_var_from_candidate_files RABBY_MOBILE_GOOGLE_PLAY_PACKAGE_NAME
  load_google_play_env_var_from_candidate_files RABBY_MOBILE_GOOGLE_PLAY_REPORT_BUCKET
  load_google_play_env_var_from_candidate_files http_proxy
  load_google_play_env_var_from_candidate_files HTTP_PROXY
  load_google_play_env_var_from_candidate_files https_proxy
  load_google_play_env_var_from_candidate_files HTTPS_PROXY
  load_google_play_env_var_from_candidate_files all_proxy
  load_google_play_env_var_from_candidate_files ALL_PROXY
  load_google_play_env_var_from_candidate_files no_proxy
  load_google_play_env_var_from_candidate_files NO_PROXY

}

resolve_google_play_default_package_name() {
  printf '%s\n' 'com.debank.rabbymobile'
}

resolve_google_play_package_name() {
  local explicit_package_name="$1"

  prepare_google_play_api_env

  if [ -n "$explicit_package_name" ]; then
    printf '%s\n' "$explicit_package_name"
    return 0
  fi

  if [ -n "${RABBY_MOBILE_GOOGLE_PLAY_PACKAGE_NAME:-}" ]; then
    printf '%s\n' "$RABBY_MOBILE_GOOGLE_PLAY_PACKAGE_NAME"
    return 0
  fi

  local default_package_name
  default_package_name=$(resolve_google_play_default_package_name)
  if [ -n "$default_package_name" ]; then
    printf '%s\n' "$default_package_name"
    return 0
  fi

  echo "Google Play package name is required. Pass it explicitly or set RABBY_MOBILE_GOOGLE_PLAY_PACKAGE_NAME." >&2
  return 1
}

resolve_google_play_report_bucket() {
  local explicit_report_bucket="$1"

  prepare_google_play_api_env

  if [ -n "$explicit_report_bucket" ]; then
    printf '%s\n' "$explicit_report_bucket"
    return 0
  fi

  if [ -n "${RABBY_MOBILE_GOOGLE_PLAY_REPORT_BUCKET:-}" ]; then
    printf '%s\n' "$RABBY_MOBILE_GOOGLE_PLAY_REPORT_BUCKET"
    return 0
  fi

  echo "Google Play report bucket is required. Pass it explicitly or set RABBY_MOBILE_GOOGLE_PLAY_REPORT_BUCKET." >&2
  return 1
}

resolve_google_play_report_month() {
  local explicit_report_month="$1"

  if [ -z "$explicit_report_month" ]; then
    date '+%Y%m'
    return 0
  fi

  case "$explicit_report_month" in
    [0-9][0-9][0-9][0-9][0-9][0-9])
      printf '%s\n' "$explicit_report_month"
      return 0
      ;;
    *)
      echo "Google Play report month must use YYYYMM format: $explicit_report_month" >&2
      return 1
      ;;
  esac
}

resolve_google_play_service_account_file() {
  local service_account_file_env="${RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_FILE:-}"
  if [ -n "$service_account_file_env" ]; then
    if [ -f "$service_account_file_env" ]; then
      printf '%s\n' "$service_account_file_env"
      return 0
    fi

    local current_project_dir
    current_project_dir=$(resolve_mobile_project_dir)
    if [ -f "$current_project_dir/$service_account_file_env" ]; then
      printf '%s\n' "$current_project_dir/$service_account_file_env"
      return 0
    fi

    echo "RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_FILE does not exist: $service_account_file_env" >&2
    return 1
  fi

  local google_application_credentials="${GOOGLE_APPLICATION_CREDENTIALS:-}"
  if [ -n "$google_application_credentials" ]; then
    if [ -f "$google_application_credentials" ]; then
      printf '%s\n' "$google_application_credentials"
      return 0
    fi

    echo "GOOGLE_APPLICATION_CREDENTIALS does not exist: $google_application_credentials" >&2
    return 1
  fi

  return 1
}

resolve_google_play_service_account_json() {
  prepare_google_play_api_env

  local service_account_json="${RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:-}"
  if [ -n "$service_account_json" ]; then
    printf '%s' "$service_account_json" | node --eval "
      let raw = '';
      process.stdin.on('data', chunk => { raw += chunk; });
      process.stdin.on('end', () => {
        const parsed = JSON.parse(raw);
        process.stdout.write(JSON.stringify(parsed));
      });
    "
    return $?
  fi

  if [ -n "${RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64:-}" ]; then
    node --eval "
      const raw = process.env.RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64 || '';
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      process.stdout.write(JSON.stringify(parsed));
    "
    return $?
  fi

  local service_account_file
  service_account_file=$(resolve_google_play_service_account_file)
  if [ -n "$service_account_file" ]; then
    node --eval "
    const fs = require('fs');
    const filePath = process.argv[1];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    process.stdout.write(JSON.stringify(parsed));
  " "$service_account_file"
    return $?
  fi

  echo "Google Play service account is required. Set one of RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64, RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_FILE, or GOOGLE_APPLICATION_CREDENTIALS." >&2
  return 1
}

make_temp_file() {
  local temp_prefix="$1"
  mktemp "${TMPDIR:-/tmp}/${temp_prefix}.XXXXXX"
}

pretty_print_json() {
  node --eval "
    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      const parsed = JSON.parse(raw);
      process.stdout.write(JSON.stringify(parsed, null, 2) + '\n');
    });
  "
}

google_play_extract_json_field() {
  local field_name="$1"
  node --eval "
    const fieldName = process.argv[1];
    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      const parsed = JSON.parse(raw);
      const value = parsed[fieldName];
      if (value === undefined || value === null) {
        process.exit(2);
      }
      if (typeof value === 'string') {
        process.stdout.write(value);
        return;
      }
      process.stdout.write(String(value));
    });
  " "$field_name"
}

google_play_emit_log() {
  printf '[RabbyMobileBuild] %s\n' "$*" >&2
}

google_play_print_api_error_hint() {
  local response_file="$1"

  [ -f "$response_file" ] || return 0

  if grep -q 'This Edit has been deleted\.' "$response_file"; then
    google_play_emit_log "hint: another Google Play edit was created concurrently. Avoid running track or bundle listing, or another upload, at the same time."
  fi

  if grep -Eq 'Version code [0-9]+ has already been used\.' "$response_file"; then
    google_play_emit_log "hint: this AAB uses a versionCode that Google Play already has. Rebuild with a new Android versionCode and upload again."
  fi
}

google_oauth_get_access_token_for_scope() {
  local oauth_scope="$1"
  local cache_suffix="$2"

  prepare_google_play_api_env

  local now_seconds
  now_seconds=$(date +%s)
  local access_token_var="RABBY_MOBILE_GOOGLE_PLAY_ACCESS_TOKEN_${cache_suffix}"
  local access_token_expires_var="RABBY_MOBILE_GOOGLE_PLAY_ACCESS_TOKEN_EXPIRES_AT_${cache_suffix}"
  local cached_access_token cached_access_token_expires_at
  eval "cached_access_token=\${$access_token_var:-}"
  eval "cached_access_token_expires_at=\${$access_token_expires_var:-}"
  if [ -n "$cached_access_token" ] && [ -n "$cached_access_token_expires_at" ] && [ "$now_seconds" -lt "$cached_access_token_expires_at" ]; then
    printf '%s\n' "$cached_access_token"
    return 0
  fi

  local service_account_json
  service_account_json=$(resolve_google_play_service_account_json) || return 1

  local jwt_assertion
  jwt_assertion=$(printf '%s' "$service_account_json" | node --eval "
    const crypto = require('crypto');

    const base64UrlEncode = value => Buffer.from(value)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      const serviceAccount = JSON.parse(raw);
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: 'RS256', typ: 'JWT' };
      const payload = {
        iss: serviceAccount.client_email,
        scope: process.argv[1],
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      };

      const unsignedToken = [
        base64UrlEncode(JSON.stringify(header)),
        base64UrlEncode(JSON.stringify(payload)),
      ].join('.');

      const signature = crypto
        .createSign('RSA-SHA256')
        .update(unsignedToken)
        .sign(serviceAccount.private_key, 'base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      process.stdout.write(unsignedToken + '.' + signature);
    });
  " "$oauth_scope") || return 1

  local token_response_file token_http_code token_response
  token_response_file=$(make_temp_file "rabby-google-play-token") || return 1
  token_http_code=$(curl -sS \
    -X POST \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer' \
    --data-urlencode "assertion=$jwt_assertion" \
    -o "$token_response_file" \
    -w '%{http_code}' \
    'https://oauth2.googleapis.com/token') || {
      cat "$token_response_file" >&2
      rm -f "$token_response_file"
      return 1
    }

  case "$token_http_code" in
    2??)
      token_response=$(cat "$token_response_file")
      rm -f "$token_response_file"
      ;;
    *)
      echo "Google OAuth token request failed (HTTP $token_http_code)" >&2
      cat "$token_response_file" >&2
      rm -f "$token_response_file"
      return 1
      ;;
  esac

  local access_token expires_in
  access_token=$(printf '%s' "$token_response" | google_play_extract_json_field access_token) || return 1
  expires_in=$(printf '%s' "$token_response" | google_play_extract_json_field expires_in) || expires_in=3600

  export "$access_token_var=$access_token"
  export "$access_token_expires_var=$((now_seconds + expires_in - 60))"

  printf '%s\n' "$access_token"
}

google_play_get_access_token() {
  google_oauth_get_access_token_for_scope \
    'https://www.googleapis.com/auth/androidpublisher' \
    'ANDROIDPUBLISHER'
}

google_play_get_cloud_storage_access_token() {
  google_oauth_get_access_token_for_scope \
    'https://www.googleapis.com/auth/devstorage.read_only' \
    'DEVSTORAGE_READ_ONLY'
}

google_api_json_request_with_access_token_provider() {
  local access_token_provider="$1"
  local error_prefix="$2"
  shift 2
  local method="$1"
  local request_url="$2"
  local request_body="$3"
  local access_token
  access_token=$("$access_token_provider") || return 1

  local response_file http_code
  response_file=$(make_temp_file "rabby-google-play-response") || return 1

  if [ -n "$request_body" ]; then
    http_code=$(curl -sS \
      -X "$method" \
      -H "Authorization: Bearer $access_token" \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json; charset=utf-8' \
      --data "$request_body" \
      -o "$response_file" \
      -w '%{http_code}' \
      "$request_url") || {
        cat "$response_file" >&2
        rm -f "$response_file"
        return 1
      }
  else
    http_code=$(curl -sS \
      -X "$method" \
      -H "Authorization: Bearer $access_token" \
      -H 'Accept: application/json' \
      -o "$response_file" \
      -w '%{http_code}' \
      "$request_url") || {
        cat "$response_file" >&2
        rm -f "$response_file"
        return 1
      }
  fi

  case "$http_code" in
    2??)
      cat "$response_file"
      rm -f "$response_file"
      return 0
      ;;
    *)
      echo "$error_prefix: $method $request_url (HTTP $http_code)" >&2
      cat "$response_file" >&2
      rm -f "$response_file"
      return 1
      ;;
  esac
}

google_play_api_json_request() {
  google_api_json_request_with_access_token_provider \
    google_play_get_access_token \
    "Google Play API request failed" \
    "$@"
}

google_cloud_storage_json_request() {
  google_api_json_request_with_access_token_provider \
    google_play_get_cloud_storage_access_token \
    "Google Cloud Storage request failed" \
    "$@"
}

google_api_download_to_file_with_access_token_provider() {
  local access_token_provider="$1"
  local error_prefix="$2"
  local success_prefix="$3"
  shift 3
  local request_url="$1"
  local output_path="$2"
  local access_token
  access_token=$("$access_token_provider") || return 1

  local current_output_dir
  current_output_dir=$(dirname "$output_path")
  mkdir -p "$current_output_dir"

  local temp_output_file http_code
  temp_output_file=$(make_temp_file "rabby-google-play-download") || return 1

  http_code=$(curl -sS \
    -L \
    -H "Authorization: Bearer $access_token" \
    -o "$temp_output_file" \
    -w '%{http_code}' \
    "$request_url") || {
      cat "$temp_output_file" >&2
      rm -f "$temp_output_file"
      return 1
    }

  case "$http_code" in
    2??)
      mv "$temp_output_file" "$output_path"
      echo "$success_prefix $output_path"
      return 0
      ;;
    *)
      echo "$error_prefix: $request_url (HTTP $http_code)" >&2
      cat "$temp_output_file" >&2
      rm -f "$temp_output_file"
      return 1
      ;;
  esac
}

google_play_api_download_to_file() {
  google_api_download_to_file_with_access_token_provider \
    google_play_get_access_token \
    "Google Play download failed" \
    "[RabbyMobileBuild] downloaded Google Play artifact to" \
    "$@"
}

google_cloud_storage_download_to_file() {
  google_api_download_to_file_with_access_token_provider \
    google_play_get_cloud_storage_access_token \
    "Google Cloud Storage download failed" \
    "[RabbyMobileBuild] downloaded Google Play report to" \
    "$@"
}

url_encode_uri_component() {
  node --eval "process.stdout.write(encodeURIComponent(process.argv[1] || ''))" "$1"
}

sanitize_filename_component() {
  printf '%s' "$1" | tr '/: @' '----' | tr -cd 'A-Za-z0-9._-'
}

resolve_google_play_financial_report_type() {
  local explicit_report_type="$1"

  case "$explicit_report_type" in
    ""|estimated-sales|estimated_sales|sales)
      printf '%s\n' 'estimated-sales'
      return 0
      ;;
    earnings)
      printf '%s\n' 'earnings'
      return 0
      ;;
    *)
      echo "Unsupported Google Play financial report type: $explicit_report_type" >&2
      echo "Supported values: estimated-sales, earnings" >&2
      return 1
      ;;
  esac
}

resolve_google_play_financial_report_object_name() {
  local report_type
  report_type=$(resolve_google_play_financial_report_type "$1") || return 1
  local report_month
  report_month=$(resolve_google_play_report_month "$2") || return 1

  case "$report_type" in
    estimated-sales)
      printf '%s\n' "sales/salesreport_${report_month}.zip"
      ;;
    earnings)
      printf '%s\n' "earnings/earnings_${report_month}.zip"
      ;;
  esac
}

build_google_cloud_storage_media_url() {
  local report_bucket="$1"
  local object_name="$2"
  local encoded_object_name
  encoded_object_name=$(url_encode_uri_component "$object_name") || return 1
  printf '%s\n' "https://storage.googleapis.com/storage/v1/b/$report_bucket/o/$encoded_object_name?alt=media"
}

build_google_play_default_bundle_path() {
  local current_project_dir
  current_project_dir=$(resolve_mobile_project_dir)

  printf '%s\n' "$current_project_dir/android/app/build/outputs/bundle/release/app-release.aab"
}

resolve_google_play_internal_track_name() {
  printf '%s\n' 'internal'
}

resolve_google_play_bundle_path() {
  local explicit_bundle_path="$1"
  local current_project_dir bundle_path
  current_project_dir=$(resolve_mobile_project_dir)

  if [ -n "$explicit_bundle_path" ]; then
    if [ -f "$explicit_bundle_path" ]; then
      printf '%s\n' "$explicit_bundle_path"
      return 0
    fi

    if [ -f "$current_project_dir/$explicit_bundle_path" ]; then
      printf '%s\n' "$current_project_dir/$explicit_bundle_path"
      return 0
    fi

    echo "Google Play bundle does not exist: $explicit_bundle_path" >&2
    return 1
  fi

  bundle_path=$(build_google_play_default_bundle_path) || return 1
  if [ ! -f "$bundle_path" ]; then
    echo "Google Play bundle does not exist at default path: $bundle_path" >&2
    return 1
  fi

  printf '%s\n' "$bundle_path"
}

resolve_google_play_android_gradle_file() {
  local current_project_dir
  current_project_dir=$(resolve_mobile_project_dir)
  printf '%s\n' "$current_project_dir/android/app/build.gradle"
}

resolve_google_play_android_version_name() {
  local gradle_file
  gradle_file=$(resolve_google_play_android_gradle_file) || return 1

  if [ ! -f "$gradle_file" ]; then
    echo "Android build.gradle does not exist: $gradle_file" >&2
    return 1
  fi

  node --eval "
    const fs = require('fs');
    const filePath = process.argv[1];
    const source = fs.readFileSync(filePath, 'utf8');
    const match = source.match(/versionName\\s+\"([^\"]+)\"/);
    if (!match) {
      process.exit(2);
    }
    process.stdout.write(match[1]);
  " "$gradle_file" || {
    echo "Could not resolve Android versionName from $gradle_file" >&2
    return 1
  }
}

resolve_google_play_android_version_code() {
  local gradle_file
  gradle_file=$(resolve_google_play_android_gradle_file) || return 1

  if [ ! -f "$gradle_file" ]; then
    echo "Android build.gradle does not exist: $gradle_file" >&2
    return 1
  fi

  node --eval "
    const fs = require('fs');
    const filePath = process.argv[1];
    const source = fs.readFileSync(filePath, 'utf8');
    const match = source.match(/versionCode\\s+([0-9]+)/);
    if (!match) {
      process.exit(2);
    }
    process.stdout.write(match[1]);
  " "$gradle_file" || {
    echo "Could not resolve Android versionCode from $gradle_file" >&2
    return 1
  }
}

detect_google_play_bundle_version_code_from_aab() {
  local bundle_path="$1"

  if [ ! -f "$bundle_path" ]; then
    echo "Google Play bundle does not exist: $bundle_path" >&2
    return 1
  fi

  python3 - "$bundle_path" <<'PY'
import re
import sys
import zipfile

bundle_path = sys.argv[1]

with zipfile.ZipFile(bundle_path, 'r') as archive:
    data = archive.read('base/manifest/AndroidManifest.xml')

for match in re.finditer(b'versionCode\\x1a(.)', data):
    length = match.group(1)[0]
    start = match.end()
    value = data[start:start + length]
    if len(value) == length and value.isdigit():
        print(value.decode('ascii'))
        sys.exit(0)

fallback = re.search(b'versionCode.{0,24}?([0-9]{1,20})', data, re.S)
if fallback:
    print(fallback.group(1).decode('ascii'))
    sys.exit(0)

print(f'Could not resolve versionCode from AAB manifest: {bundle_path}', file=sys.stderr)
sys.exit(1)
PY
}

resolve_google_play_bundle_version_code() {
  local bundle_path="$1"
  local bundle_version_code

  if bundle_version_code=$(detect_google_play_bundle_version_code_from_aab "$bundle_path" 2>/dev/null); then
    printf '%s\n' "$bundle_version_code"
    return 0
  fi

  resolve_google_play_android_version_code
}

build_google_play_default_release_name() {
  local version_name="$1"
  local version_code="$2"
  printf '%s\n' "Rabby Wallet($version_name.$version_code)"
}

normalize_google_play_release_notes_text() {
  node --eval "
    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      let normalized = raw.replace(/^\\uFEFF/, '').replace(/\\r\\n/g, '\\n').trim();
      normalized = normalized.replace(/^\\s{0,3}#{1,6}\\s+/gm, '');
      normalized = normalized.trim();
      process.stdout.write(normalized);
    });
  "
}

build_google_play_default_release_notes_text() {
  local version_name="$1"
  local current_project_dir
  current_project_dir=$(resolve_mobile_project_dir)

  local changelog_path
  for changelog_path in \
    "$current_project_dir/src/changeLogs/$version_name.android.md" \
    "$current_project_dir/src/changeLogs/$version_name.md"; do
    if [ -f "$changelog_path" ]; then
      cat "$changelog_path" | normalize_google_play_release_notes_text
      return 0
    fi
  done

  cat <<'EOF' | normalize_google_play_release_notes_text
Features

- Fixed some bugs and optimized user experience
EOF
}

resolve_google_play_release_notes_text() {
  local release_notes_file="$1"
  local version_name="$2"

  if [ -n "$release_notes_file" ]; then
    if [ ! -f "$release_notes_file" ]; then
      echo "Google Play release notes file does not exist: $release_notes_file" >&2
      return 1
    fi
    cat "$release_notes_file" | normalize_google_play_release_notes_text
    return 0
  fi

  build_google_play_default_release_notes_text "$version_name"
}

release_name_should_use_google_play_default() {
  local explicit_release_name="$1"

  case "$explicit_release_name" in
    ""|"Android Internal Test")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

google_play_render_release_notes_tagged() {
  local release_notes_language="$1"
  local release_notes_text="$2"

  if [ -z "$release_notes_text" ]; then
    return 0
  fi

  printf '<%s>\n%s\n</%s>\n' \
    "$release_notes_language" \
    "$release_notes_text" \
    "$release_notes_language"
}

google_play_get_track_in_edit() {
  local package_name="$1"
  local edit_id="$2"
  local track_name="$3"
  local access_token
  access_token=$(google_play_get_access_token) || return 1

  local response_file http_code
  response_file=$(make_temp_file "rabby-google-play-track") || return 1

  http_code=$(curl -sS \
    -X GET \
    -H "Authorization: Bearer $access_token" \
    -H 'Accept: application/json' \
    -o "$response_file" \
    -w '%{http_code}' \
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package_name/edits/$edit_id/tracks/$track_name") || {
      cat "$response_file" >&2
      rm -f "$response_file"
      return 1
    }

  case "$http_code" in
    2??)
      cat "$response_file"
      rm -f "$response_file"
      return 0
      ;;
    404)
      rm -f "$response_file"
      return 4
      ;;
    *)
      echo "Google Play track request failed: GET /applications/$package_name/edits/$edit_id/tracks/$track_name (HTTP $http_code)" >&2
      cat "$response_file" >&2
      rm -f "$response_file"
      return 1
      ;;
  esac
}

google_play_list_tracks_in_edit() {
  local package_name="$1"
  local edit_id="$2"
  google_play_api_json_request \
    GET \
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package_name/edits/$edit_id/tracks" \
    ''
}

google_play_extract_highest_version_code_from_tracks_json() {
  node --eval "
    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      const parsed = JSON.parse(raw);
      const tracks = Array.isArray(parsed.tracks) ? parsed.tracks : [];
      let highest = null;

      for (const track of tracks) {
        const releases = Array.isArray(track.releases) ? track.releases : [];
        for (const release of releases) {
          const versionCodes = Array.isArray(release.versionCodes) ? release.versionCodes : [];
          for (const versionCode of versionCodes) {
            const numeric = Number(versionCode);
            if (!Number.isFinite(numeric)) {
              continue;
            }
            if (highest === null || numeric > highest) {
              highest = numeric;
            }
          }
        }
      }

      if (highest !== null) {
        process.stdout.write(String(highest));
      }
    });
  "
}

resolve_google_play_latest_version_code() {
  local package_name="$1"

  local edit_response edit_id tracks_response status latest_version_code
  edit_response=$(google_play_create_edit "$package_name") || return 1
  edit_id=$(printf '%s' "$edit_response" | google_play_extract_json_field id) || return 1

  status=0
  tracks_response=$(google_play_list_tracks_in_edit "$package_name" "$edit_id") || status=$?
  google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
  [ "$status" -eq 0 ] || return "$status"

  latest_version_code=$(printf '%s' "$tracks_response" | google_play_extract_highest_version_code_from_tracks_json) || return 1
  if [ -n "$latest_version_code" ]; then
    printf '%s\n' "$latest_version_code"
  fi
}

google_play_warn_if_version_code_not_ahead() {
  local local_version_code="$1"
  local explicit_package_name="$2"
  local context_label="$3"

  if [ -z "$local_version_code" ]; then
    google_play_emit_log "warning: could not determine local Android versionCode for $context_label"
    return 0
  fi

  local package_name
  package_name=$(resolve_google_play_package_name "$explicit_package_name") || return 0

  if ! resolve_google_play_service_account_json >/dev/null 2>&1; then
    google_play_emit_log "warning: skipping Google Play versionCode preflight for $context_label because no service account credentials are available"
    return 0
  fi

  local latest_version_code
  if ! latest_version_code=$(resolve_google_play_latest_version_code "$package_name" 2>/dev/null); then
    google_play_emit_log "warning: could not query the latest Google Play versionCode for $context_label"
    return 0
  fi

  if [ -z "$latest_version_code" ]; then
    google_play_emit_log "warning: no existing Google Play releases were found when checking $context_label"
    return 0
  fi

  if [ "$local_version_code" -le "$latest_version_code" ]; then
    google_play_emit_log "warning: local versionCode $local_version_code is not higher than the latest Google Play versionCode $latest_version_code for $context_label. Upload may fail until you bump versionCode."
  else
    google_play_emit_log "Google Play versionCode preflight passed for $context_label: local=$local_version_code latest=$latest_version_code"
  fi
}

google_play_build_track_request_without_drafts() {
  node --eval "
    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      const parsed = JSON.parse(raw);
      const releases = Array.isArray(parsed.releases) ? parsed.releases : [];
      const retained = releases.filter(release => release && release.status !== 'draft');
      process.stdout.write(JSON.stringify({ releases: retained }));
    });
  "
}

google_play_extract_draft_release_summary() {
  node --eval "
    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      const parsed = JSON.parse(raw);
      const releases = Array.isArray(parsed.releases) ? parsed.releases : [];
      const drafts = releases.filter(release => release && release.status === 'draft');
      if (drafts.length === 0) {
        return;
      }
      const summary = drafts.map(release => {
        const name = release.name || '(unnamed draft)';
        const versionCodes = Array.isArray(release.versionCodes) ? release.versionCodes.join(',') : '';
        return 'name=' + name + ', versionCodes=' + versionCodes;
      }).join(' | ');
      process.stdout.write(summary);
    });
  "
}

google_play_delete_draft_releases_on_track() {
  local package_name="$1"
  local track_name="$2"

  local edit_response edit_id track_response status draft_summary update_request
  edit_response=$(google_play_create_edit "$package_name") || return 1
  edit_id=$(printf '%s' "$edit_response" | google_play_extract_json_field id) || return 1

  status=0
  track_response=$(google_play_get_track_in_edit "$package_name" "$edit_id" "$track_name") || status=$?
  case "$status" in
    0)
      ;;
    4)
      google_play_emit_log "no existing track named $track_name was found while attempting draft cleanup"
      google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
      return 0
      ;;
    *)
      google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
      return "$status"
      ;;
  esac

  draft_summary=$(printf '%s' "$track_response" | google_play_extract_draft_release_summary) || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }

  if [ -z "$draft_summary" ]; then
    google_play_emit_log "no draft releases need cleanup on track $track_name"
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 0
  fi

  google_play_emit_log "attempting to delete draft releases on track $track_name: $draft_summary"
  update_request=$(printf '%s' "$track_response" | google_play_build_track_request_without_drafts) || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }

  google_play_api_json_request \
    PUT \
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package_name/edits/$edit_id/tracks/$track_name" \
    "$update_request" >/dev/null || {
      google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
      return 1
    }

  google_play_commit_edit "$package_name" "$edit_id" >/dev/null || return 1
  google_play_emit_log "deleted draft releases on track $track_name"
}

google_play_log_existing_track_release() {
  local track_name="$1"
  local track_response="$2"

  printf '%s' "$track_response" | node --eval "
    const trackName = process.argv[1];
    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      const parsed = JSON.parse(raw);
      const releases = Array.isArray(parsed.releases) ? parsed.releases : [];
      if (releases.length === 0) {
        process.stdout.write('[RabbyMobileBuild] track ' + trackName + ' exists but has no active releases\\n');
        return;
      }

      const summaries = releases.map(release => {
        const name = release.name || '(unnamed release)';
        const status = release.status || 'unknown';
        const versionCodes = Array.isArray(release.versionCodes) ? release.versionCodes.join(',') : '';
        return 'name=' + name + ', status=' + status + ', versionCodes=' + versionCodes;
      });

      process.stdout.write('[RabbyMobileBuild] current ' + trackName + ' release before upload: ' + summaries.join(' | ') + '\\n');
    });
  " "$track_name" >&2
}

google_play_create_edit() {
  local package_name="$1"
  google_play_api_json_request POST "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package_name/edits" '{}'
}

google_play_delete_edit() {
  local package_name="$1"
  local edit_id="$2"
  google_play_api_json_request DELETE "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package_name/edits/$edit_id" '' >/dev/null
}

google_play_commit_edit() {
  local package_name="$1"
  local edit_id="$2"
  google_play_api_json_request POST "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package_name/edits/$edit_id:commit" '{}'
}

google_play_upload_bundle_to_edit() {
  local package_name="$1"
  local edit_id="$2"
  local bundle_path="$3"
  local access_token
  access_token=$(google_play_get_access_token) || return 1

  local response_file http_code
  response_file=$(make_temp_file "rabby-google-play-bundle-upload") || return 1

  if [ -t 2 ]; then
    http_code=$(curl --progress-bar --show-error \
      -X POST \
      -H "Authorization: Bearer $access_token" \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/octet-stream' \
      --data-binary "@$bundle_path" \
      -o "$response_file" \
      -w '%{http_code}' \
      "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/$package_name/edits/$edit_id/bundles?uploadType=media") || {
        cat "$response_file" >&2
        rm -f "$response_file"
        return 1
      }
  else
    http_code=$(curl -sS \
      -X POST \
      -H "Authorization: Bearer $access_token" \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/octet-stream' \
      --data-binary "@$bundle_path" \
      -o "$response_file" \
      -w '%{http_code}' \
      "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/$package_name/edits/$edit_id/bundles?uploadType=media") || {
        cat "$response_file" >&2
        rm -f "$response_file"
        return 1
      }
  fi

  case "$http_code" in
    2??)
      cat "$response_file"
      rm -f "$response_file"
      return 0
      ;;
    *)
      echo "Google Play bundle upload failed: $bundle_path (HTTP $http_code)" >&2
      cat "$response_file" >&2
      google_play_print_api_error_hint "$response_file"
      rm -f "$response_file"
      return 1
      ;;
  esac
}

google_play_build_release_notes_json() {
  local release_notes_language="$1"
  local release_notes_text="$2"

  printf '%s' "$release_notes_text" | node --eval "
    const language = process.argv[1];
    let raw = '';
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      const text = raw.replace(/\r\n/g, '\n').trim();
      if (!text) {
        process.stdout.write('[]');
        return;
      }
      process.stdout.write(JSON.stringify([{ language, text }]));
    });
  " "$release_notes_language"
}

google_play_build_track_update_request() {
  local version_code="$1"
  local release_name="$2"
  local release_notes_json="$3"
  local release_status="$4"

  node --eval "
    const versionCode = String(process.argv[1]);
    const releaseName = process.argv[2];
    const releaseStatus = process.argv[3];
    const releaseNotes = JSON.parse(process.argv[4] || '[]');

    const payload = {
      releases: [{
        versionCodes: [versionCode],
        status: releaseStatus,
      }],
    };

    if (releaseName) {
      payload.releases[0].name = releaseName;
    }

    if (Array.isArray(releaseNotes) && releaseNotes.length > 0) {
      payload.releases[0].releaseNotes = releaseNotes;
    }

    process.stdout.write(JSON.stringify(payload));
  " "$version_code" "$release_name" "$release_status" "$release_notes_json"
}

resolve_google_play_release_status() {
  local explicit_release_status="$1"

  case "$explicit_release_status" in
    ""|completed)
      printf '%s\n' 'completed'
      return 0
      ;;
    draft)
      printf '%s\n' 'draft'
      return 0
      ;;
    *)
      echo "Unsupported Google Play release status: $explicit_release_status" >&2
      echo "Supported values: completed, draft" >&2
      return 1
      ;;
  esac
}

google_play_upload_bundle_to_internal_track() {
  local explicit_bundle_path="$1"
  local explicit_package_name="$2"
  local explicit_release_status="$3"
  local release_name="$4"
  local release_notes_file="$5"
  local release_notes_language="$6"
  local explicit_release_name="$4"

  if [ -z "$release_notes_language" ]; then
    release_notes_language="en-US"
  fi

  local bundle_path package_name release_notes_text release_notes_json release_status bundle_version_code
  local internal_track_name
  bundle_path=$(resolve_google_play_bundle_path "$explicit_bundle_path") || return 1
  package_name=$(resolve_google_play_package_name "$explicit_package_name") || return 1
  release_status=$(resolve_google_play_release_status "$explicit_release_status") || return 1
  internal_track_name=$(resolve_google_play_internal_track_name) || return 1

  bundle_version_code=$(resolve_google_play_bundle_version_code "$bundle_path" 2>/dev/null || true)
  if [ -n "$bundle_version_code" ]; then
    google_play_emit_log "detected local bundle versionCode=$bundle_version_code before upload"
    google_play_warn_if_version_code_not_ahead "$bundle_version_code" "$package_name" "Google Play upload preflight"
  else
    google_play_emit_log "warning: could not determine local bundle versionCode before upload"
  fi

  if ! google_play_delete_draft_releases_on_track "$package_name" "$internal_track_name"; then
    google_play_emit_log "warning: failed to delete existing draft releases on track $internal_track_name; continuing upload attempt"
  fi

  local bundle_size_human=""
  bundle_size_human=$(du -h "$bundle_path" 2>/dev/null | awk 'NR == 1 { print $1 }') || true

  local edit_response edit_id upload_response version_code track_request track_response commit_response existing_track_response
  local version_name
  google_play_emit_log "creating Google Play edit for package $package_name"
  edit_response=$(google_play_create_edit "$package_name") || return 1
  edit_id=$(printf '%s' "$edit_response" | google_play_extract_json_field id) || return 1
  google_play_emit_log "created Google Play edit $edit_id"

  version_name=$(resolve_google_play_android_version_name) || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }

  release_notes_text=$(resolve_google_play_release_notes_text "$release_notes_file" "$version_name") || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }
  release_notes_json=$(google_play_build_release_notes_json "$release_notes_language" "$release_notes_text") || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }

  existing_track_response=""
  if existing_track_response=$(google_play_get_track_in_edit "$package_name" "$edit_id" "$internal_track_name"); then
    google_play_log_existing_track_release "$internal_track_name" "$existing_track_response"
  else
    case $? in
      4)
        google_play_emit_log "no existing release found on track $internal_track_name"
        ;;
      *)
        google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
        return 1
        ;;
    esac
  fi

  if [ -n "$bundle_size_human" ]; then
    google_play_emit_log "uploading Android App Bundle $bundle_path ($bundle_size_human)"
  else
    google_play_emit_log "uploading Android App Bundle $bundle_path"
  fi
  upload_response=$(google_play_upload_bundle_to_edit "$package_name" "$edit_id" "$bundle_path") || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }

  version_code=$(printf '%s' "$upload_response" | google_play_extract_json_field versionCode) || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }
  if release_name_should_use_google_play_default "$explicit_release_name"; then
    release_name=$(build_google_play_default_release_name "$version_name" "$version_code") || {
      google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
      return 1
    }
  fi
  google_play_emit_log "uploaded bundle successfully, versionCode=$version_code"
  google_play_emit_log "release name: $release_name"
  google_play_emit_log "release status: $release_status"
  google_play_emit_log "release notes payload:"
  google_play_render_release_notes_tagged "$release_notes_language" "$release_notes_text" >&2

  track_request=$(google_play_build_track_update_request "$version_code" "$release_name" "$release_notes_json" "$release_status") || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }

  google_play_emit_log "updating Google Play internal track $internal_track_name"
  track_response=$(google_play_api_json_request \
    PUT \
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package_name/edits/$edit_id/tracks/$internal_track_name" \
    "$track_request") || {
      google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
      return 1
    }

  google_play_emit_log "committing Google Play edit $edit_id"
  commit_response=$(google_play_commit_edit "$package_name" "$edit_id") || {
    google_play_delete_edit "$package_name" "$edit_id" >/dev/null 2>&1 || true
    return 1
  }
  google_play_emit_log "Google Play internal-track upload finished"

  local upload_response_base64 track_response_base64 commit_response_base64
  upload_response_base64=$(printf '%s' "$upload_response" | base64 | tr -d '\n')
  track_response_base64=$(printf '%s' "$track_response" | base64 | tr -d '\n')
  commit_response_base64=$(printf '%s' "$commit_response" | base64 | tr -d '\n')

  node --eval "
    const decode = value => Buffer.from(value, 'base64').toString('utf8');
    const bundlePath = process.argv[1];
    const packageName = process.argv[2];
    const editId = process.argv[3];
    const versionCode = String(process.argv[4]);
    const track = process.argv[5];
    const upload = JSON.parse(decode(process.argv[6]));
    const trackResponse = JSON.parse(decode(process.argv[7]));
    const commit = JSON.parse(decode(process.argv[8]));
    const release = Array.isArray(trackResponse.releases) ? trackResponse.releases[0] || null : null;

    process.stdout.write(JSON.stringify({
      bundlePath,
      packageName,
      track,
      editId,
      versionCode,
      releaseStatus: release ? release.status || null : null,
      releaseName: release ? release.name || null : null,
      uploadedBundle: {
        sha1: upload.sha1 || null,
        sha256: upload.sha256 || null,
      },
      committedEditId: commit.id || null,
    }, null, 2) + '\n');
  " \
    "$bundle_path" \
    "$package_name" \
    "$edit_id" \
    "$version_code" \
    "$internal_track_name" \
    "$upload_response_base64" \
    "$track_response_base64" \
    "$commit_response_base64"
}

check_s3_params() {
  if [ -z $RABBY_MOBILE_BUILD_BUCKET ]; then
    echo "RABBY_MOBILE_BUILD_BUCKET is not set"
    exit 1;
  fi
}

checkout_s3_pub_deployment_params() {
  if [ -z $BUILD_TARGET_PLATFORM ]; then
    export BUILD_TARGET_PLATFORM="android"
  fi
  if [ -z $buildchannel ]; then
    export buildchannel="selfhost-reg"
  fi
  case $buildchannel in
    "appstore"|"selfhost")
      S3_ANDROID_PUB_DEPLOYMENT=$RABBY_MOBILE_PROD_PUB_DEPLOYMENT
      export S3_ANDROID_BAK_DEPLOYMENT=$RABBY_MOBILE_PROD_BAK_DEPLOYMENT
      S3_IOS_PUB_DEPLOYMENT=$RABBY_MOBILE_PROD_PUB_DEPLOYMENT
      export S3_IOS_BAK_DEPLOYMENT=$RABBY_MOBILE_PROD_BAK_DEPLOYMENT
      ;;
    "selfhost-reg")
      S3_ANDROID_PUB_DEPLOYMENT=$RABBY_MOBILE_REG_PUB_DEPLOYMENT
      export S3_ANDROID_BAK_DEPLOYMENT=$RABBY_MOBILE_REG_BAK_DEPLOYMENT
      S3_IOS_PUB_DEPLOYMENT=$RABBY_MOBILE_PUB_DEPLOYMENT
      export S3_IOS_BAK_DEPLOYMENT=$RABBY_MOBILE_BAK_DEPLOYMENT
      ;;
    *)
      echo "Invalid buildchannel: $buildchannel"
      exit 1;
      ;;
  esac

  if [ $BUILD_TARGET_PLATFORM == 'ios' ]; then
    if [ -z $S3_IOS_PUB_DEPLOYMENT ]; then
      echo "[buildchannel:$buildchannel] S3_IOS_PUB_DEPLOYMENT is not set"
      exit 1;
    fi

    if [ -z $S3_IOS_BAK_DEPLOYMENT ]; then
      echo "[buildchannel:$buildchannel] S3_IOS_BAK_DEPLOYMENT is not set"
      exit 1;
    fi

    export s3_upload_prefix=$(echo "$S3_IOS_PUB_DEPLOYMENT" | sed "s#s3://${RABBY_MOBILE_BUILD_BUCKET}/##g" | cut -d'/' -f2-)
    # echo "[debug] s3_upload_prefix is $s3_upload_prefix"
    export cdn_deployment_urlbase="https://download.rabby.io/$s3_upload_prefix"
  elif [ $BUILD_TARGET_PLATFORM == 'android' ]; then
    export s3_upload_prefix=$(echo "$S3_ANDROID_PUB_DEPLOYMENT" | sed "s#s3://${RABBY_MOBILE_BUILD_BUCKET}/##g" | cut -d'/' -f2-)
    # echo "[debug] s3_upload_prefix is $s3_upload_prefix"
    export cdn_deployment_urlbase="https://download.rabby.io/$s3_upload_prefix"
  else
    echo "Invalid BUILD_TARGET_PLATFORM: $BUILD_TARGET_PLATFORM"
    exit 1;
  fi
}

unix_replace_variables() {
    local input_file="$1"
    local output_file="$2"
    shift 2

    if [ ! -f "$input_file" ]; then
        echo "Input $input_file doesn't exist"
        exit 1
    fi

    [ -f $output_file ] && rm "$output_file";
    cp "$input_file" "$output_file"

    while [[ "$#" -gt 0 ]]; do
        local kv="$1"
        # echo "[debug] kv is $kv"

        if [[ "$kv" == --var-* ]]; then
            local var_name=$(echo "$kv" | cut -d'=' -f1 | cut -c 7-)
            local var_value=$(echo "$kv" | cut -d'=' -f2)

            # echo "[debug] var_name is $var_name"
            # echo "[debug] var_value is $var_value"

            local escaped_value=$(printf '%s\n' "$var_value" | sed -e 's/[\/&]/\\&/g')

            if [ $UNIX_TYPE == Darwin ]; then
              # on macOS
              sed -i '' "s#{{ ${var_name} }}#$escaped_value#g" "$output_file"
              sed -i '' "s#{{ __${var_name}__ }}#$escaped_value#g" "$output_file"
            else
              # on Linux
              sed -i "s#{{ ${var_name} }}#$escaped_value#g" "$output_file"
              sed -i "s#{{ __${var_name}__ }}#$escaped_value#g" "$output_file"
            fi
            shift
        else
            echo "Invalid argument: $kv"
            exit 1
        fi
    done

    echo "Replace finished, result in $output_file"
}

reset_builtin_assets() {
  local script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
  local project_dir=$(dirname $script_dir)

  # local targets=(
  #   # $project_dir/android/app/src/main/assets/fonts
  #   $project_dir/ios/RabbyMobile/Resources/
  # )
  # for target in "${targets[@]}"
  # do
  #   echo "cleanup and copy fonts to $target..."
  #   rm -rf $target && mkdir -p $target;
  #   cp $project_dir/assets/fonts/* $target
  # done

  # iOS
  local ios_target=$project_dir/ios/RabbyMobile/Resources/
  echo "cleanup and copy fonts to $ios_target..."
  rm -rf $ios_target && mkdir -p $ios_target;
  cp $project_dir/assets/fonts/* $ios_target

  # Android
  mkdir -p $project_dir/android/app/src/main/assets/fonts && \
    rm -rf $project_dir/android/app/src/main/assets/fonts/*.ttf;

  local android_assets_target=$project_dir/android/app/src/main/assets
  # local android_font_target=$project_dir/android/app/src/main/res/font
  echo "cleanup and copy fonts to $android_assets_target/fonts..."
  cp $project_dir/assets/fonts/* $project_dir/android/app/src/main/assets/fonts/
  echo "cleanup and copy custom js to $android_assets_target/custom..."

  # remove after migrate to built-in pages :start
  mkdir -p $project_dir/android/app/src/main/assets/custom/;
  cp $project_dir/assets/custom/*.js $project_dir/android/app/src/main/assets/custom/
  # remove after migrate to built-in pages :end

  mkdir -p $project_dir/android/app/src/main/assets/custom/builtin-pages;
  rm -rf $project_dir/android/app/src/main/assets/custom/builtin-pages/*;
  if [ -d $project_dir/assets/android/builtin-pages/ ]; then
    cp -r $project_dir/assets/android/builtin-pages/* $project_dir/android/app/src/main/assets/custom/builtin-pages/
  else
    echo "haven't build $project_dir/assets/android/builtin-pages/, skipped copy";
  fi

  # rm -f $android_assets_target/sf_pro_all.ttf && cp $project_dir/assets/fonts/* $ios_target
}

build_worker_if_not_exist() {
  local script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
  local project_dir=$(dirname $script_dir)

  # ./assets/ios/threads/worker.thread.jsbundle
  local ios_target=$project_dir/assets/ios/threads/worker.thread.jsbundle
  if [ ! -f $ios_target ]; then
    echo "[build_worker_if_not_exist] $ios_target not exist, building..."
    yarn buildworker:prod:ios
  else
    echo "[build_worker_if_not_exist] $ios_target exist, skipped."
  fi

  # ./android/app/src/main/assets/threads/worker.thread.bundle
  local android_target=$project_dir/android/app/src/main/assets/threads/worker.thread.bundle
  if [ ! -f $android_target ]; then
    echo "[build_worker_if_not_exist] $android_target not exist, building..."
    yarn buildworker:prod:android
  else
    echo "[build_worker_if_not_exist] $android_target exist, skipped."
  fi
}

print_cmd_upload_changelog() {
  proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
  if [ -z $upload_ver ]; then
    upload_ver=$proj_version
  fi
  echo "[print_cmd_upload_changelog] try to find markdown changelog for version $upload_ver"
  echo ""

  # android
  if [ -f src/changeLogs/$upload_ver.android.md ]; then
    echo "aws s3 cp src/changeLogs/$upload_ver.android.md s3://\$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/android/$upload_ver.md --acl authenticated-read --content-type text/plain"
  elif [ -f src/changeLogs/$upload_ver.md ]; then
    echo "aws s3 cp src/changeLogs/$upload_ver.md s3://\$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/android/$upload_ver.md --acl authenticated-read --content-type text/plain"
  else
    echo "No change log file found for android version $upload_ver"
  fi

  #ios
  if [ -f src/changeLogs/$upload_ver.ios.md ]; then
    echo "aws s3 cp src/changeLogs/$upload_ver.ios.md s3://\$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/ios/$upload_ver.md --acl authenticated-read --content-type text/plain"
  elif [ -f src/changeLogs/$upload_ver.md ]; then
    echo "aws s3 cp src/changeLogs/$upload_ver.md s3://\$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/ios/$upload_ver.md --acl authenticated-read --content-type text/plain"
  else
    echo "No change log file found for ios version $upload_ver"
  fi

  echo ""
  echo "Now you can upload the markdown files to S3"
}

run_upload_changelog() {
  proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
  if [ -z $upload_ver ]; then
    upload_ver=$proj_version
  fi
  echo "[run_upload_changelog] try to find markdown changelog for version $upload_ver"
  echo ""

  # android
  if [ -f src/changeLogs/$upload_ver.android.md ]; then
    aws s3 cp src/changeLogs/$upload_ver.android.md s3://$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/android/$upload_ver.md --acl authenticated-read --content-type text/plain
  elif [ -f src/changeLogs/$upload_ver.md ]; then
    aws s3 cp src/changeLogs/$upload_ver.md s3://$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/android/$upload_ver.md --acl authenticated-read --content-type text/plain
  else
    echo "No change log file found for android version $upload_ver"
  fi

  #ios
  if [ -f src/changeLogs/$upload_ver.ios.md ]; then
    aws s3 cp src/changeLogs/$upload_ver.ios.md s3://$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/ios/$upload_ver.md --acl authenticated-read --content-type text/plain
  elif [ -f src/changeLogs/$upload_ver.md ]; then
    aws s3 cp src/changeLogs/$upload_ver.md s3://$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/ios/$upload_ver.md --acl authenticated-read --content-type text/plain
  else
    echo "No change log file found for ios version $upload_ver"
  fi

  echo ""
  echo "Now you can upload the markdown files to S3"
}

update_webview_assets() {
  if [ -z $project_dir ]; then
    local script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
    project_dir=$(dirname $script_dir)
  fi
  curl -fSL https://unpkg.com/vconsole@3.15.1/dist/vconsole.min.js -o $project_dir/assets/custom/vconsole.min.js
  # curl -fSL https://cdn.jsdelivr.net/npm/bignumber.js@9.3.1/bignumber.min.js -o $project_dir/assets/custom/bignumber.js@9.3.1-bignumber.min.js
  # curl -fSL https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js -o $project_dir/assets/custom/lightweight-charts.standalone.production.js
}


func_to_exec=$1

if [ ! -z $func_to_exec ]; then
  case $func_to_exec in
    "--source-only")
      # do nothing
      ;;
    "reset_builtin_assets")
      reset_builtin_assets
      ;;
    "build_worker_if_not_exist")
      build_worker_if_not_exist
      ;;
    "build_worker")
      yarn buildworker:prod:ios
      yarn buildworker:prod:android
      ;;
    "run_upload_changelog")
      run_upload_changelog
      ;;
    "print_cmd_upload_changelog")
      print_cmd_upload_changelog
      ;;
    "update_webview_assets")
      update_webview_assets
      ;;
    "print_ios_rabbit_code")
      shift
      print_ios_rabbit_code "$1"
      ;;
    "google_play_upload_bundle_to_internal_track")
      shift
      google_play_upload_bundle_to_internal_track "$1" "$2" "$3" "$4" "$5" "$6"
      ;;
    *)
      echo "Invalid function to execute: $func_to_exec"
      exit 1;
      ;;
  esac
fi
