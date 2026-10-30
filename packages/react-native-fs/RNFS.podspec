require 'json'
pjson = JSON.parse(File.read('package.json'))

Pod::Spec.new do |s|

  s.name            = "RNFS"
  s.version         = pjson["version"]
  s.homepage        = "https://github.com/itinance/react-native-fs"
  s.summary         = pjson["description"]
  s.license         = pjson["license"]
  s.author          = { "Johannes Lumpe" => "johannes@lum.pe" }
  
  s.ios.deployment_target = '12.4'
  s.tvos.deployment_target = '9.2'
  s.osx.deployment_target = '10.10'

  s.source          = { :git => "https://github.com/itinance/react-native-fs", :tag => "v#{s.version}" }
  s.source_files    = [
    '*.{h,m,mm}',
    'ios/**/*.{h,m,mm}',
    'cpp/**/*.{h,cpp}'
  ]
  s.preserve_paths  = [
    "**/*.js",
    "rust/safe-svg/Cargo.toml",
    "rust/safe-svg/Cargo.lock",
    "rust/safe-svg/rust-toolchain.toml",
    "rust/safe-svg/src/lib.rs",
    "rust/safe-svg/include/rabby_safe_svg.h",
    "rust/safe-svg/scripts/build-rust.sh"
  ]
  safe_svg_library = '$(TARGET_TEMP_DIR)/rabby-safe-svg/librabby_safe_svg.a'
  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    "ENABLE_USER_SCRIPT_SANDBOXING" => "NO",
    "OTHER_LIBTOOLFLAGS" => "$(inherited) #{safe_svg_library}",
    "OTHER_LDFLAGS" => "$(inherited) #{safe_svg_library}"
  }
  s.script_phase = {
    :name => 'Build Rabby Safe SVG Rust library',
    :execution_position => :before_compile,
    :script => <<-SCRIPT,
      set -euo pipefail
      ARCH_LIST="${ARCHS:-${CURRENT_ARCH}}"
      OUTPUT="${TARGET_TEMP_DIR}/rabby-safe-svg/librabby_safe_svg.a"
      /bin/bash "${PODS_TARGET_SRCROOT}/rust/safe-svg/scripts/build-rust.sh" \
        ios "${PLATFORM_NAME}:${ARCH_LIST}" "${OUTPUT}"
    SCRIPT
    :input_files => [
      '${PODS_TARGET_SRCROOT}/rust/safe-svg/Cargo.toml',
      '${PODS_TARGET_SRCROOT}/rust/safe-svg/Cargo.lock',
      '${PODS_TARGET_SRCROOT}/rust/safe-svg/rust-toolchain.toml',
      '${PODS_TARGET_SRCROOT}/rust/safe-svg/src/lib.rs',
      '${PODS_TARGET_SRCROOT}/rust/safe-svg/scripts/build-rust.sh'
    ],
    :output_files => [safe_svg_library]
  }
  s.library = 'z'

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
    s.dependency 'React-jsi'
  end
end
