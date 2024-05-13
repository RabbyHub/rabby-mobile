#!/bin/sh

UNIX_TYPE=$(uname -s)
RABBY_HOST_OS=`uname`

case $RABBY_HOST_OS in
  MINGW*|CYGWIN*|MSYS_NT*)
    RABBY_HOST_OS="Windows"
    ;;
esac

case $OSTYPE in
  msys*|cygwin*)
    RABBY_HOST_OS="Windows"
    ;;
esac

prepare_env() {
  export script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
  export project_dir=$script_dir
}

check_build_params() {
  if [ -z $RABBY_MOBILE_KR_PWD ]; then
    echo "RABBY_MOBILE_KR_PWD is not set"
    exit 1;
  fi
}

check_s3_params() {
  if [ -z $RABBY_MOBILE_BUILD_BUCKET ]; then
    echo "RABBY_MOBILE_BUILD_BUCKET is not set"
    exit 1;
  fi
}

checkout_s3_pub_deployment_params() {
  if [ -z $BUILD_TARGET_PLATFORM ]; then
    export BUILD_TARGET_PLATFORM="android"
  fi
  if [ -z $buildchannel ]; then
    export buildchannel="selfhost-reg"
  fi
  case $buildchannel in
    "appstore"|"selfhost")
      S3_ANDROID_PUB_DEPLOYMENT=$RABBY_MOBILE_PROD_PUB_DEPLOYMENT
      export S3_ANDROID_BAK_DEPLOYMENT=$RABBY_MOBILE_PROD_BAK_DEPLOYMENT
      S3_IOS_PUB_DEPLOYMENT=$RABBY_MOBILE_PROD_PUB_DEPLOYMENT
      export S3_IOS_BAK_DEPLOYMENT=$RABBY_MOBILE_PROD_BAK_DEPLOYMENT
      ;;
    "selfhost-reg")
      S3_ANDROID_PUB_DEPLOYMENT=$RABBY_MOBILE_REG_PUB_DEPLOYMENT
      export S3_ANDROID_BAK_DEPLOYMENT=$RABBY_MOBILE_REG_BAK_DEPLOYMENT
      S3_IOS_PUB_DEPLOYMENT=$RABBY_MOBILE_PUB_DEPLOYMENT
      export S3_IOS_BAK_DEPLOYMENT=$RABBY_MOBILE_BAK_DEPLOYMENT
      ;;
    *)
      echo "Invalid buildchannel: $buildchannel"
      exit 1;
      ;;
  esac

  if [ $BUILD_TARGET_PLATFORM == 'ios' ]; then
    if [ -z $S3_IOS_PUB_DEPLOYMENT ]; then
      echo "[buildchannel:$buildchannel] S3_IOS_PUB_DEPLOYMENT is not set"
      exit 1;
    fi

    if [ -z $S3_IOS_BAK_DEPLOYMENT ]; then
      echo "[buildchannel:$buildchannel] S3_IOS_BAK_DEPLOYMENT is not set"
      exit 1;
    fi

    export s3_upload_prefix=$(echo "$S3_IOS_PUB_DEPLOYMENT" | sed "s#s3://${RABBY_MOBILE_BUILD_BUCKET}/##g" | cut -d'/' -f2-)
    # echo "[debug] s3_upload_prefix is $s3_upload_prefix"
    export cdn_deployment_urlbase="https://download.rabby.io/$s3_upload_prefix"
  elif [ $BUILD_TARGET_PLATFORM == 'android' ]; then
    export s3_upload_prefix=$(echo "$S3_ANDROID_PUB_DEPLOYMENT" | sed "s#s3://${RABBY_MOBILE_BUILD_BUCKET}/##g" | cut -d'/' -f2-)
    # echo "[debug] s3_upload_prefix is $s3_upload_prefix"
    export cdn_deployment_urlbase="https://download.rabby.io/$s3_upload_prefix"
  else
    echo "Invalid BUILD_TARGET_PLATFORM: $BUILD_TARGET_PLATFORM"
    exit 1;
  fi
}

unix_replace_variables() {
    local input_file="$1"
    local output_file="$2"
    shift 2

    if [ ! -f "$input_file" ]; then
        echo "Input $input_file doesn't exist"
        exit 1
    fi

    [ -f $output_file ] && rm "$output_file";
    cp "$input_file" "$output_file"

    while [[ "$#" -gt 0 ]]; do
        local kv="$1"
        # echo "[debug] kv is $kv"

        if [[ "$kv" == --var-* ]]; then
            local var_name=$(echo "$kv" | cut -d'=' -f1 | cut -c 7-)
            local var_value=$(echo "$kv" | cut -d'=' -f2)

            # echo "[debug] var_name is $var_name"
            # echo "[debug] var_value is $var_value"

            local escaped_value=$(printf '%s\n' "$var_value" | sed -e 's/[\/&]/\\&/g')

            if [ $UNIX_TYPE == Darwin ]; then
              # on macOS
              sed -i '' "s#{{ ${var_name} }}#$escaped_value#g" "$output_file"
              sed -i '' "s#{{ __${var_name}__ }}#$escaped_value#g" "$output_file"
            else
              # on Linux
              sed -i "s#{{ ${var_name} }}#$escaped_value#g" "$output_file"
              sed -i "s#{{ __${var_name}__ }}#$escaped_value#g" "$output_file"
            fi
            shift
        else
            echo "Invalid argument: $kv"
            exit 1
        fi
    done

    echo "Replace finished, result in $output_file"
}
