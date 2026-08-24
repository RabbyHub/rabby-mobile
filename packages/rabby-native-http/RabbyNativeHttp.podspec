require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'RabbyNativeHttp'
  spec.version = package['version']
  spec.summary = package['description']
  spec.homepage = 'https://github.com/RabbyHub/rabby-mobile'
  spec.license = package['license']
  spec.author = { 'Rabby Wallet' => 'mobile@rabby.io' }
  spec.source = { :path => '.' }
  spec.ios.deployment_target = '15.1'
  spec.source_files = 'cpp/include/**/*.h', 'cpp/*.cpp', 'ios/**/*.{h,mm}'
  spec.public_header_files = 'cpp/include/**/*.h'
  spec.header_mappings_dir = 'cpp/include'
  spec.frameworks = 'Foundation'
  spec.requires_arc = true
  spec.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'DEFINES_MODULE' => 'YES',
    'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_TARGET_SRCROOT}/cpp/include"'
  }
end
