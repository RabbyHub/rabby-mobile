#!/bin/bash

fbscript_dir="$( cd "$( dirname "$0"  )" && pwd  )"

find_build_tools_version() {
  local latest_line=$(sdkmanager --list_installed | grep "build-tools" | LC_COLLATE=C sort -rV | head -1)
  # pick first line
  local latest_version=$(echo $latest_line | sed -E 's/.*build-tools;([0-9]+\.[0-9]+\.[0-9]+).*/\1/')
  echo $latest_version
}

# list all files consist native part for android app
# sort them, calculate their checksums, join them with spaces, then calculate the final checksum
collect_android_native_entries() {
  if [ -z $script_dir ]; then
    echo "script_dir is not set, please set it before running this script."
    exit 1
  fi
  # filterout output
  node $script_dir/fast-build/collect_android_native_hashes.js calculate_hash >> /dev/null

  # local node_output=$(node $script_dir/fast-build/collect_android_native_hashes.js calculate_hash)
  # # extract hash from sample `export TEMPLATE_FINGERPRINT="d9ba9047670a00f559c60769559b4f4fa0cb697674b34df761b7edee2f78bd67"`
  # local native_part_hash=$(echo "$node_output" | grep '^export TEMPLATE_FINGERPRINT=' | cut -d'=' -f2- | tr -d '"')
  # # echo "TEMPLATE_FINGERPRINT=$native_part_hash"
  # echo $native_part_hash;

  echo $(cat $script_dir/fast-build/android_native_files_sha256.txt)
}

download_template_apk_by_hash() {
  if [ -z $script_dir ]; then
    echo "script_dir is not set, please set it before running this script."
    exit 1
  fi

  local template_hash="$1"
  local template_apk_url="https://download.rabby.io/downloads/wallet-mobile-reg/.templates/android/${template_hash}.apk"

  # check if template_apk_url is valid
  if ! curl --output /dev/null --silent --head --fail "$template_apk_url"; then
    echo "Template APK not found at $template_apk_url"
    exit 1
  fi

  echo "[debug] Downloading template APK from $template_apk_url"
  curl -L -o "$script_dir/.fast-build-work/template.apk" "$template_apk_url"
  if [ $? -ne 0 ]; then
    echo "Failed to download template APK."
    exit 1
  fi
}
