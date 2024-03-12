#!/bin/sh

## script deprecated, use fastlane instead

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$script_dir

# .xcworkspace
workspace_name="RabbyMobile"
# scheme name in .xcworkspace
scheme_name="RabbyMobile"

# Release, Debug
build_configuration="Release"

# build type: development, ad-hoc, app-store, enterprise
# ./build.sh method # default method is ad-hoc
method=${1:-ad-hoc}

 [[ $method = app-store ]] && mobileprovision_name="RabbyMobileAppStore" || mobileprovision_name="RabbyMobileAdHoc"

bundle_identifier="com.debank.rabby-mobile"

echo "-------------------- Check params --------------------"
echo "workspace_name=${workspace_name}"
echo "scheme_name=${scheme_name}"
echo "build_configuration=${build_configuration}"
echo "bundle_identifier=${bundle_identifier}"
echo "method=${method}"
echo "mobileprovision_name=${mobileprovision_name} \033[0m"

# Time
if [ -z $BUILD_DATE ]; then
    BUILD_DATE=`date '+%Y%m%d_%H%M%S'`
fi

export_path="$project_dir/Package/$scheme_name-$BUILD_DATE"
export_archive_path="$export_path/$scheme_name.xcarchive"
export_ipa_path="$export_path"
export ipa_name="${scheme_name}_${BUILD_DATE}"
export_options_plist_path="$project_dir/ExportOptions.plist"


echo "-------------------- Check Params --------------------"
echo "\033[33;1mproject_dir=${project_dir}"
echo "BUILD_DATE=${BUILD_DATE}"
echo "export_path=${export_path}"
echo "export_archive_path=${export_archive_path}"
echo "export_ipa_path=${export_ipa_path}"
echo "export_options_plist_path=${export_options_plist_path}"
echo "ipa_name=${ipa_name} \033[0m"

# ======================= Build Phase ====================== #

echo "------------------------------------------------------"
echo "\033[32mStart Building  \033[0m"
cd ${project_dir}

if [ -d "$export_path" ] ; then
    echo $export_path
else
    mkdir -pv $export_path
fi

xcodebuild clean -workspace ${workspace_name}.xcworkspace \
                 -scheme ${scheme_name} \
                 -configuration ${build_configuration} \
                 -quiet

xcodebuild archive -workspace ${workspace_name}.xcworkspace \
                   -scheme ${scheme_name} \
                   -configuration ${build_configuration} \
                   -archivePath ${export_archive_path} \
                   -destination 'generic/platform=iOS' \
                   -quiet

if [ -d "$export_archive_path" ] ; then
    echo "\033[32;1m Build success 🚀 🚀 🚀  \033[0m"
else
    echo "\033[31;1m Build failed 😢 😢 😢  \033[0m"
    exit 1
fi
echo "------------------------------------------------------"

echo "\033[32m Exporting ipa file \033[0m"


if [ -f "$export_options_plist_path" ] ; then
    # echo "${export_options_plist_path} existed, delete it"
    rm -f $export_options_plist_path
fi

# generate export_options_plist file
/usr/libexec/PlistBuddy -c  "Add :method String ${method}"  $export_options_plist_path
/usr/libexec/PlistBuddy -c  "Add :provisioningProfiles:"  $export_options_plist_path
/usr/libexec/PlistBuddy -c  "Add :provisioningProfiles:${bundle_identifier} String ${mobileprovision_name}"  $export_options_plist_path
/usr/libexec/PlistBuddy -c  "Add :signingStyle String automatic"  $export_options_plist_path
/usr/libexec/PlistBuddy -c  "Add :destination String export"  $export_options_plist_path
# If your project need to enable Bitcode use true
/usr/libexec/PlistBuddy -c  "Add :compileBitcode bool false"  $export_options_plist_path

echo "\033[32mm export_options_plist: ${export_options_plist_path}       \033[0m"


xcodebuild  -exportArchive \
            -archivePath ${export_archive_path} \
            -exportPath ${export_ipa_path} \
            -exportOptionsPlist ${export_options_plist_path} \
            -allowProvisioningUpdates \
            -quiet

# check if ipa file exists
if [ -f "$export_ipa_path/$scheme_name.ipa" ] ; then
    echo "\033[32;1m exportArchive ipa success, prepare to rename \033[0m"
else
    echo "\033[31;1m exportArchive ipa failed 😢 😢 😢     \033[0m"
    exit 1
fi

mv $export_ipa_path/$scheme_name.ipa $export_ipa_path/$ipa_name.ipa

# check if renamed ipa file exists
if [ -f "$export_ipa_path/$ipa_name.ipa" ] ; then
    echo "\033[32;1m export ${ipa_name}.ipa success 🎉  🎉  🎉   \033[0m"
    open $export_path
else
    echo "\033[31;1m export ${ipa_name}.ipa failed 😢 😢 😢     \033[0m"
    exit 1
fi

# clean export_options_plist file
if [ -f "$export_options_plist_path" ] ; then
    # echo "delete ${export_options_plist_path}"
    rm -f $export_options_plist_path
fi

if [ -z $build_export_path ]; then
  build_export_path="$project_dir/outputs"
fi
mkdir -p $build_export_path;
cp $export_ipa_path/$ipa_name.ipa $build_export_path/rabbymobile.ipa

# output build time
echo "\033[36;1m IOS build time: ${SECONDS}s \033[0m"

