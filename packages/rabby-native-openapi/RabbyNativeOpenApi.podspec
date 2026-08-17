Pod::Spec.new do |s|
  s.name = 'RabbyNativeOpenApi'
  s.version = '0.1.0'
  s.summary = 'Native Rabby OpenAPI synchronization foundation'
  s.homepage = 'https://github.com/RabbyHub/rabby-mobile'
  s.license = { :type => 'MIT' }
  s.author = 'Rabby Wallet'
  s.platforms = { :ios => '15.1' }
  s.source = { :path => '.' }
  s.source_files = [
    'cpp/include/**/*.h',
    'cpp/*.cpp',
    'cpp/third_party/**/*.{h,hpp,cc,cpp}',
    'ios/**/*.{h,mm}',
  ]
  s.header_mappings_dir = 'cpp/include'
  s.public_header_files = 'cpp/include/**/*.h'
  s.dependency 'RabbyNativeHttp', '0.1.0'
  s.library = 'sqlite3'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_TARGET_SRCROOT}/cpp/include" "${PODS_TARGET_SRCROOT}/cpp/third_party/json11" "${PODS_CONFIGURATION_BUILD_DIR}/RabbyNativeHttp/RabbyNativeHttp.framework/Headers"',
  }
end
