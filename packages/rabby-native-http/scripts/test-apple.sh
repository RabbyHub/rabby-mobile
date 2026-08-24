#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="${TMPDIR:-/tmp}/rabby-native-http-tests"
port_file="$build_dir/server-port"
mkdir -p "$build_dir"
rm -f "$port_file"

node "$root_dir/scripts/native-http-test-server.js" "$port_file" &
server_pid=$!
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  rm -f "$port_file"
}
trap cleanup EXIT

for _ in $(seq 1 100); do
  [[ -s "$port_file" ]] && break
  sleep 0.02
done
[[ -s "$port_file" ]]

xcrun clang++ \
  -std=c++17 \
  -fobjc-arc \
  -Wall \
  -Wextra \
  -Werror \
  -I"$root_dir/cpp/include" \
  -framework Foundation \
  "$root_dir/cpp/RabbyHttpTypes.cpp" \
  "$root_dir/ios/AppleHttpClient.mm" \
  "$root_dir/cpp/tests/AppleHttpClientTest.mm" \
  -o "$build_dir/AppleHttpClientTest"

"$build_dir/AppleHttpClientTest" "http://127.0.0.1:$(<"$port_file")"
