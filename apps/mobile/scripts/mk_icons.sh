#!/usr/bin/env sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname "$script_dir")

ios_godfile_dir=$script_dir/bundles;

mk_ios_icons() {
  # for iOS
  local ios_sizes=(
    ## AppIcon.appiconset
    # iPhone Notification
    40 40 "2x" logo-1024w.png AppIcon.appiconset
    60 60 "3x" logo-1024w.png AppIcon.appiconset
    # iPhone Settings
    58 58 "2x" logo-1024w.png AppIcon.appiconset
    87 87 "3x" logo-1024w.png AppIcon.appiconset
    # iPhone Spotlight
    80 80 "2x" logo-1024w.png AppIcon.appiconset
    120 120 "3x" logo-1024w.png AppIcon.appiconset
    # iPhone App
    120 120 "2x" logo-1024w.png AppIcon.appiconset
    180 180 "3x" logo-1024w.png AppIcon.appiconset
    # App Store
    1024 1024 "1x" logo-1024w.png AppIcon.appiconset

    ## LaunchScreen.imageset
    91 79 "1x" splash-logo-512w.png LaunchScreen.imageset
    182 158 "2x" splash-logo-512w.png LaunchScreen.imageset
    273 237 "3x" splash-logo-512w.png LaunchScreen.imageset
  )

  local ios_icons_dir=$project_dir/ios/RabbyMobile/Images.xcassets/;

  for ((i=0;i<${#ios_sizes[@]};i+=5))
  do
      local w=${ios_sizes[i]}
      local h=${ios_sizes[i+1]}
      local scale=${ios_sizes[i+2]}
      local godfile=${ios_sizes[i+3]}
      local setname=${ios_sizes[i+4]}

      sips -z $h $w $ios_godfile_dir/$godfile --out $ios_icons_dir/$setname/icon_${w}x${h}@${scale}.png
  done
}

# iconutil -c icns $iconset_dir -o $script_dir/bundles/icon.icns
# rm -rf $iconset_dir;

mk_ios_icons;

echo "[mk_icons] success!"
