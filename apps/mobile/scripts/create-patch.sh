#!/bin/sh

# ./node_modules/.bin/patch-package @isudaji/react-native-install-apk --exclude 'build|xcodeproj|package.json'
./node_modules/.bin/patch-package react-native-webview --exclude 'lib|build|xcodeproj|package.json' --include 'android\/.*\/(RNCWebChromeClient|RNCWebViewClient)\.java|apple\/(RNCWebViewImpl|RNCWebView)\.m'
./node_modules/.bin/patch-package @debank/common
./node_modules/.bin/patch-package react-native-mmkv --exclude 'android\/.cxx|build|xcodeproj|package.json'
