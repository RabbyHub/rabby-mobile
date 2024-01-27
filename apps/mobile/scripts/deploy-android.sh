#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

# . $script_dir/fns.sh --source-only

# check_s3_params;
# checkout_s3_pub_deployment_params;

BUILD_DATE=`date '+%Y%m%d_%H%M%S'`

sh $project_dir/android/build.sh bundleRelease

# WIP: backup

# WIP: upload version.json

# WIP: .well-known
