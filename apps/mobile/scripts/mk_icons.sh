#!/usr/bin/env sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname "$script_dir")

ios_godfile_dir=$script_dir/bundles;

mk_ios_icons() {
  local ios_icons_dir=$project_dir/ios/RabbyMobile/Images.xcassets/;

  # for iOS
  local ios_sizes=(
    ## AppIcon.appiconset
    # iPhone Notification
    40 40 "2x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset
    60 60 "3x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset
    # iPhone Settings
    58 58 "2x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset
    87 87 "3x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset
    # iPhone Spotlight
    80 80 "2x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset
    120 120 "3x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset
    # iPhone App
    120 120 "2x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset
    180 180 "3x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset
    # App Store
    1024 1024 "1x" logo-1024w.png $ios_icons_dir/AppIcon.appiconset

    ## LaunchScreen.imageset
    91 79 "1x" splash-logo-512w.png $ios_icons_dir/LaunchScreen.imageset
    182 158 "2x" splash-logo-512w.png $ios_icons_dir/LaunchScreen.imageset
    273 237 "3x" splash-logo-512w.png $ios_icons_dir/LaunchScreen.imageset

    ## For Deployment
    512 512 "512w" logo-1024w.png $script_dir/deployments/ios/
    57 57 "57w" logo-1024w.png $script_dir/deployments/ios/
  )


  for ((i=0;i<${#ios_sizes[@]};i+=5))
  do
      local w=${ios_sizes[i]}
      local h=${ios_sizes[i+1]}
      local scale=${ios_sizes[i+2]}
      local godfile=${ios_sizes[i+3]}
      local targetdir=${ios_sizes[i+4]}

      sips -z $h $w $ios_godfile_dir/$godfile --out $targetdir/icon_${w}x${h}@${scale}.png
  done
}

# iconutil -c icns $iconset_dir -o $script_dir/bundles/icon.icns
# rm -rf $iconset_dir;

mk_ios_icons;

echo "[mk_icons] success!"
