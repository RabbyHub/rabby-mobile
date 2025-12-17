#!/usr/bin/env sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

# can_prune=true
# debug, regression, production
case $RABBY_GO_ENV in
  regression|mobile-regression)
    RABBY_GO_ENV="mobile-regression"
    echo "Deploying regression build..."
    local_dir="mobile-regression"
    s3_dir="rabby-go-regression/$local_dir"
    ;;
  production|mobile-production)
    RABBY_GO_ENV="mobile-production"
    echo "Deploying production build..."
    local_dir="mobile"
    s3_dir="rabby-go/$local_dir"
    # can_prune=false
    ;;
  debug|mobile-debug|*)
    RABBY_GO_ENV="mobile-debug"
    echo "Deploying debug build..."
    local_dir="mobile-debug"
    s3_dir="rabby-go-debug/$local_dir"
    ;;
esac

dist_dir=$project_dir/dist/$local_dir;
if [ -z $SKIP_BUILD ]; then
  rm -rf $dist_dir
  # ./node_modules/.bin/vite build --mode $RABBY_GO_ENV
  RABBY_GO_ENV=$RABBY_GO_ENV yarn build
fi

if [ ! -z "$REALLY_UPLOAD" ]; then
  if [ -z $RABBY_MOBILE_BUILD_BUCKET ]; then
    echo "RABBY_MOBILE_BUILD_BUCKET is not set, please set it before deploying."
    exit 1
  fi

  # sync the dist directory to S3,
  common_sync_options='--exact-timestamps --acl public-read --metadata-directive REPLACE';
  # prune expired files on developer's machine
  if [ -z "$CI" ]; then
    common_sync_options="$common_sync_options --delete"
  fi
  # html
  aws s3 sync $dist_dir/ s3://${RABBY_MOBILE_BUILD_BUCKET}/$s3_dir/ --exclude "*" --include "*.html" --content-type "text/html" $common_sync_options
  # js
  aws s3 sync $dist_dir/ s3://${RABBY_MOBILE_BUILD_BUCKET}/$s3_dir/ --exclude "*" --include "*.js" --content-type "application/javascript" $common_sync_options
  # css
  aws s3 sync $dist_dir/ s3://${RABBY_MOBILE_BUILD_BUCKET}/$s3_dir/ --exclude "*" --include "*.css" --content-type "text/css" $common_sync_options
  # svg
  aws s3 sync $dist_dir/ s3://${RABBY_MOBILE_BUILD_BUCKET}/$s3_dir/ --exclude "*" --include "*.svg" --content-type "image/svg+xml" $common_sync_options
  # png
  aws s3 sync $dist_dir/ s3://${RABBY_MOBILE_BUILD_BUCKET}/$s3_dir/ --exclude "*" --include "*.png" --content-type "image/png" $common_sync_options
  # jpeg/jpg
  aws s3 sync $dist_dir/ s3://${RABBY_MOBILE_BUILD_BUCKET}/$s3_dir/ --exclude "*" --include "*.jpeg" --content-type "image/jpeg" $common_sync_options
  aws s3 sync $dist_dir/ s3://${RABBY_MOBILE_BUILD_BUCKET}/$s3_dir/ --exclude "*" --include "*.jpg" --content-type "image/jpeg" $common_sync_options

  # if [ ! -z $RABBY_GO_CDN_FRONTEND_ID ]; then
  #   echo "Automatically refresh CDN"
  #   aws cloudfront create-invalidation --distribution-id $RABBY_GO_CDN_FRONTEND_ID --paths "/$local_dir/*"
  #   echo "CDN invalidation created"
  # fi
  echo "You can refresh CDN by the command below"
  echo "aws cloudfront create-invalidation --distribution-id \$RABBY_GO_CDN_FRONTEND_ID --paths "/$local_dir/*""
fi

echo "Refresh by \`aws cloudfront create-invalidation --distribution-id \$RABBY_GO_CDN_FRONTEND_ID --paths '/$local_dir/*'\`"
