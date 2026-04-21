require 'json'
version = JSON.parse(File.read('package.json'))["version"]

Pod::Spec.new do |s|

  s.name           = "RabbyRNKeychain"
  s.version        = version
  s.summary        = "Local Rabby fork of react-native-keychain 8.2.0."
  s.homepage       = "https://github.com/RabbyHub/rabby-mobile"
  s.license        = "MIT"
  s.author         = { "Rabby Mobile" => "mobile@rabby.io" }
  s.ios.deployment_target = '9.0'
  s.tvos.deployment_target = '9.0'
  s.osx.deployment_target = '10.13'
  s.visionos.deployment_target = '1.0'
  s.source         = { :git => "https://github.com/RabbyHub/rabby-mobile.git", :tag => "v#{s.version}" }
  s.source_files   = 'RNKeychainManager/**/*.{h,m}'
  s.preserve_paths = "**/*.js"
  s.dependency 'React-Core'

end
