#!/bin/bash
set -euo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/validate-hash-helper.sh"

override_dotenv

bundle exec fastlane android hashcheck destination_path:"$LOG_DIR"

{
  cat <<EOF

{
  "platform": "android",
  "build_time": "$(date '+%Y-%m-%d %H:%M:%S %Z')",
  "clang_version": "$(clang --version | head -n1)",
  "node_version": "$(node -v | head -n1)",
  "npm_version": "$(npm -v | head -n1)",
  "yarn_version": "$(yarn -v | head -n1)",
  "gradle_version": "$($WORK_DIR/android/gradlew --version | grep 'Gradle' | awk '{print $2}')",
  "jdk_version": "$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}')"
}

EOF
} >>"$BUILD_REPORT_FILE"

echo_envs
