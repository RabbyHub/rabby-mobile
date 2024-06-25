#!/usr/bin/env sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname "$script_dir")

os_name=$(uname -s)

image_godfile_dir=$script_dir/bundles;

mk_ios_icons() {

  if [ "$os_name" != "Darwin" ]; then
    echo "[mk_ios_icons] not on macOS, skip."
    return ;
  fi

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

      sips -z $h $w $image_godfile_dir/$godfile --out $targetdir/icon_${w}x${h}@${scale}.png
  done
}

android_splash_icons=(
  mipmap-mdpi splash_logo.png
  mipmap-hdpi splash_logo@2x.png
  mipmap-xhdpi splash_logo@3x.png
  mipmap-xxhdpi splash_logo@3x.png
  mipmap-xxxhdpi splash_logo@3x.png
)

mk_android_icons() {
  # launch screen
  $project_dir/node_modules/.bin/s2v \
    -t "#FFF" \
    -i $script_dir/bundles/splash-logo.svg \
    -o $project_dir/android/app/src/main/res/drawable/ic_launch_screen.xml

  # replace #FF000000 with #FFFFFF
  sed -i '' 's/#FF000000/#FFFFFF/g' $project_dir/android/app/src/main/res/drawable/ic_launch_screen.xml

  for ((i=0;i<${#android_splash_icons[@]};i+=2))
  do
      local targetdir=${android_splash_icons[i]}
      local srcfile=${android_splash_icons[i+1]}

      cp $image_godfile_dir/android/$srcfile $project_dir/android/app/src/main/res/$targetdir/splash_logo.png
  done

  # launcher icon
  $project_dir/node_modules/.bin/s2v \
    -t "#FFF" \
    -i $script_dir/bundles/ic_launcher.svg \
    -o $script_dir/bundles/ic_launcher_logo_core.xml

  # replace #FF000000 with #FFFFFF
  sed -i '' 's/#FF000000/#FFFFFF/g' $script_dir/bundles/ic_launcher_logo_core.xml

  echo "[mk_android_icons] generate app's logo by Image Assets in Android Studio."

  # local android_icons_dir=$project_dir/android/app/src/main/res;

  # if [ "$os_name" == "Darwin" ]; then
  #   # app logos
  #   local android_sizes=(
  #     # mdpi
  #     48 logo-1024w.png $android_icons_dir/mipmap-mdpi/ic_launcher.png
  #     48 logo-1024w-r.png $android_icons_dir/mipmap-mdpi/ic_launcher_round.png
  #     # hdpi
  #     72 logo-1024w.png $android_icons_dir/mipmap-hdpi/ic_launcher.png
  #     72 logo-1024w-r.png $android_icons_dir/mipmap-hdpi/ic_launcher_round.png
  #     # xhdpi
  #     96 logo-1024w.png $android_icons_dir/mipmap-xhdpi/ic_launcher.png
  #     96 logo-1024w-r.png $android_icons_dir/mipmap-xhdpi/ic_launcher_round.png
  #     # xxhdpi
  #     144 logo-1024w.png $android_icons_dir/mipmap-xxhdpi/ic_launcher.png
  #     144 logo-1024w-r.png $android_icons_dir/mipmap-xxhdpi/ic_launcher_round.png
  #     # xxxhdpi
  #     192 logo-1024w.png $android_icons_dir/mipmap-xxxhdpi/ic_launcher.png
  #     192 logo-1024w-r.png $android_icons_dir/mipmap-xxxhdpi/ic_launcher_round.png
  #   )

  #   for ((i=0;i<${#android_sizes[@]};i+=3))
  #   do
  #       local w=${android_sizes[i]}
  #       local h=${android_sizes[i]}
  #       local godfile=${android_sizes[i+1]}
  #       local targetfile=${android_sizes[i+2]}

  #       sips -z $h $w $image_godfile_dir/$godfile --out $targetfile
  #   done
  # else
  #   echo "[mk_android_icons] not on macOS, skip."
  #   return ;
  # fi
}

mk_ios_icons;
mk_android_icons;

echo "[mk_icons] success!"
