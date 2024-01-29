#!/usr/bin/env sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname "$script_dir")

if [ -z $VERSION ]; then
  echo "VERSION is required"
  exit 1;
fi

npm version --no-git-tag-version $VERSION
