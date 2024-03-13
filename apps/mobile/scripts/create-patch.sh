#!/bin/sh

./node_modules/.bin/patch-package @isudaji/react-native-install-apk --exclude 'build|xcodeproj|package.json'
# ./node_modules/.bin/patch-package react-native-webview --exclude 'build|xcodeproj|package.json' --include 'android'
