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
  s.preserve_paths  = "**/*.js"
  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
  }

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency 'React-Core'
    s.dependency 'React-jsi'
  end
end
