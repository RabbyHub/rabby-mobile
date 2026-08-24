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
  s.dependency 'op-sqlite', '15.1.1'
  private_signer_enabled =
    ENV['RABBY_NATIVE_OPENAPI_PRIVATE_SIGNER_POD'] == '1'
  if private_signer_enabled
    s.dependency 'RabbyNativeOpenApiSigner', ENV.fetch('RABBY_NATIVE_OPENAPI_SIGNER_VERSION')
  end
  private_signer_header_path =
    '"${PODS_CONFIGURATION_BUILD_DIR}/RabbyNativeOpenApiSigner/RabbyNativeOpenApiSigner.framework/Headers"'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'HEADER_SEARCH_PATHS' => [
      '$(inherited)',
      '"${PODS_TARGET_SRCROOT}/cpp/include"',
      '"${PODS_TARGET_SRCROOT}/cpp/third_party/json11"',
      '"${PODS_ROOT}/Headers/Public"',
      '"${PODS_CONFIGURATION_BUILD_DIR}/RabbyNativeHttp/RabbyNativeHttp.framework/Headers"',
      (private_signer_header_path if private_signer_enabled),
    ].compact.join(' '),
    'GCC_PREPROCESSOR_DEFINITIONS' => [
      '$(inherited)',
      ('RABBY_NATIVE_OPENAPI_PRIVATE_SIGNER=1' if private_signer_enabled),
    ].compact.join(' '),
  }
end
