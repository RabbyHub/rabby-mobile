#!/bin/bash

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $(dirname "$script_dir"))

# Function to check if a binary contains bitcode
check_bitcode() {
  local binary_path=$1
  if otool -l "$binary_path" | grep -q __LLVM; then
    echo "$binary_path contains bitcode."
    echo "$binary_path" >> bitcode_frameworks.txt
  else
    echo "$binary_path does not contain bitcode."
  fi
}

# Function to strip bitcode from a binary
strip_bitcode() {
  local binary_path=$1
  local output_path="${binary_path}_stripped"
  xcrun bitcode_strip "$binary_path" -r -o "$output_path"
  echo "Stripped bitcode from $binary_path and saved to $output_path"
}

# Function to replace original binary with the stripped version
replace_framework() {
  local original_path=$1
  local stripped_path="${original_path}_stripped"

  if [ -f "$stripped_path" ]; then
    echo "Replacing $original_path with $stripped_path..."
    rm "$original_path"
    mv "$stripped_path" "$original_path"
    echo "Replaced $original_path successfully."
  else
    echo "Stripped binary $stripped_path not found. Skipping."
  fi
}

# Function to disable Bitcode in the Xcode project
disable_bitcode_in_project() {
  # Automatically detect the Xcode project file
  local xcodeproj_file=$(find . -name "*.xcodeproj" | head -n 1)
  if [ -z "$xcodeproj_file" ]; then
    echo "Xcode project not found. Exiting."
    exit 1
  fi
  local xcodeproj_name=$(basename "$xcodeproj_file" .xcodeproj)

  echo "Disabling Bitcode in Xcode project $xcodeproj_name..."
  /usr/libexec/PlistBuddy -c "Set :buildSettings:ENABLE_BITCODE NO" "$xcodeproj_file/project.pbxproj"

  # Clean and rebuild the Xcode project
  echo "Cleaning the build folder..."
  xcodebuild clean -workspace "$xcodeproj_name.xcworkspace" -scheme "$xcodeproj_name" -configuration Debug

  echo "Building the project..."
  xcodebuild -workspace "$xcodeproj_name.xcworkspace" -scheme "$xcodeproj_name" -configuration Debug

  echo "Process completed successfully!"
}

# Step 1: Check frameworks for Bitcode
echo "Checking frameworks for Bitcode..."

# Remove old bitcode_frameworks.txt if it exists
rm -f bitcode_frameworks.txt

# Check frameworks in Pods and the ios directory
if [ -d "Pods" ]; then
  echo "Checking frameworks in Pods..."
  find Pods -name '*.framework' -type d | while read -r framework; do
    binary_name=$(basename "$framework" .framework)
    binary_path="$framework/$binary_name"
    if [ -f "$binary_path" ]; then
      check_bitcode "$binary_path"
    fi
  done
fi

echo "Checking frameworks in the ios directory..."
find . -name '*.framework' -type d | while read -r framework; do
  binary_name=$(basename "$framework" .framework)
  binary_path="$framework/$binary_name"
  if [ -f "$binary_path" ]; then
    check_bitcode "$binary_path"
  fi
done

echo "Bitcode check completed. Frameworks containing bitcode are listed in bitcode_frameworks.txt."

# Step 2: Strip Bitcode from all frameworks that contain it
if [ -f bitcode_frameworks.txt ]; then
  echo "Stripping bitcode from frameworks..."
  while read -r binary_path; do
    strip_bitcode "$binary_path"
  done < bitcode_frameworks.txt
else
  echo "No frameworks found containing bitcode. Exiting."
  exit 1
fi

# Step 3: Replace original frameworks with stripped versions
echo "Replacing original frameworks with stripped versions..."
while read -r binary_path; do
  replace_framework "$binary_path"
done < bitcode_frameworks.txt

# Step 4: Disable Bitcode in the Xcode project and rebuild
disable_bitcode_in_project
