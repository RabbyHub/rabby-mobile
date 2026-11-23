require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name = "RabbyDurationPicker"
  s.version = package["version"]
  s.summary = package["description"]
  s.homepage = "https://github.com/RabbyHub/rabby-mobile"
  s.license = package["license"]
  s.authors = "Rabby"
  s.platforms = { :ios => "15.1" }
  s.source = { :git => "https://github.com/RabbyHub/rabby-mobile.git", :tag => s.version }
  s.source_files = "ios/**/*.{h,mm}"
  install_modules_dependencies(s)
end
