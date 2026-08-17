#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="${TMPDIR:-/tmp}/rabby-native-http-tests"
mkdir -p "$build_dir"

${CXX:-c++} \
  -std=c++17 \
  -Wall \
  -Wextra \
  -Werror \
  -I"$root_dir/cpp/include" \
  "$root_dir/cpp/RabbyHttpTypes.cpp" \
  "$root_dir/cpp/tests/RabbyHttpTypesTest.cpp" \
  -o "$build_dir/RabbyHttpTypesTest"

"$build_dir/RabbyHttpTypesTest"
