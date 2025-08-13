#!/usr/bin/env sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

if [ -z $RABBY_MOBILE_BUILD_BUCKET ]; then
  echo "RABBY_MOBILE_BUILD_BUCKET is not set, please set it before deploying."
  exit 1
fi

# debug, regression, production
case $RABBY_GO_ENV in
  regression|mobile-regression)
    RABBY_GO_ENV="mobile-regression"
    echo "Deploying regression build..."
    s3_dir="mobile-regression"
    ;;
  production|mobile-production)
    RABBY_GO_ENV="mobile-production"
    echo "Deploying production build..."
    s3_dir="mobile"
    ;;
  debug|mobile-debug|*)
    RABBY_GO_ENV="mobile-debug"
    echo "Deploying debug build..."
    s3_dir="mobile-debug"
    ;;
esac

if [ -z $SKIP_BUILD ]; then
  vite build --mode $RABBY_GO_ENV
fi

if [ -z $SKIP_SYNC ]; then
  # sync the dist directory to S3,
  common_sync_options='--exact-timestamps --acl public-read --metadata-directive REPLACE';
  # prune expired files on developer's machine
  if [ -z $CI ]; then
    common_sync_options="$common_sync_options --delete"
  fi
  # html
  aws s3 sync ./dist s3://${RABBY_MOBILE_BUILD_BUCKET}/rabby-go/$s3_dir/ --exclude "*" --include "*.html" --content-type "text/html" $common_sync_options
  # js
  aws s3 sync ./dist s3://${RABBY_MOBILE_BUILD_BUCKET}/rabby-go/$s3_dir/ --exclude "*" --include "*.js" --content-type "application/javascript" $common_sync_options
  # css
  aws s3 sync ./dist s3://${RABBY_MOBILE_BUILD_BUCKET}/rabby-go/$s3_dir/ --exclude "*" --include "*.css" --content-type "text/css" $common_sync_options
  # svg
  aws s3 sync ./dist s3://${RABBY_MOBILE_BUILD_BUCKET}/rabby-go/$s3_dir/ --exclude "*" --include "*.svg" --content-type "image/svg+xml" $common_sync_options
  # png
  aws s3 sync ./dist s3://${RABBY_MOBILE_BUILD_BUCKET}/rabby-go/$s3_dir/ --exclude "*" --include "*.png" --content-type "image/png" $common_sync_options
  # jpeg/jpg
  aws s3 sync ./dist s3://${RABBY_MOBILE_BUILD_BUCKET}/rabby-go/$s3_dir/ --exclude "*" --include "*.jpeg" --content-type "image/jpeg" $common_sync_options
  aws s3 sync ./dist s3://${RABBY_MOBILE_BUILD_BUCKET}/rabby-go/$s3_dir/ --exclude "*" --include "*.jpg" --content-type "image/jpeg" $common_sync_options
fi

echo "Refresh by \`aws cloudfront create-invalidation --distribution-id \$RABBY_GO_CDN_FRONTEND_ID --paths '/$s3_dir/*'\`"
if [ ! -z $RABBY_GO_CDN_FRONTEND_ID ]; then
  echo "Automatically refresh CDN"
  aws cloudfront create-invalidation --distribution-id $RABBY_GO_CDN_FRONTEND_ID --paths "/$s3_dir/*"
  echo "CDN invalidation created"
fi
