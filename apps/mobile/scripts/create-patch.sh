#!/bin/sh

# ./node_modules/.bin/patch-package @isudaji/react-native-install-apk --exclude 'build|xcodeproj|package.json'
./node_modules/.bin/patch-package react-native-webview --exclude 'build|xcodeproj|package.json' --include 'lib\/.*\.d\.ts|android\/.*\/(RNCWebChromeClient|RNCWebViewClient)\.java|apple\/(RNCWebViewImpl|RNCWebView)\.m'
./node_modules/.bin/patch-package @debank/common
./node_modules/.bin/patch-package react-native-fs --exclude 'android\/build' --include 'android'
./node_modules/.bin/patch-package react-native-mmkv --exclude 'android\/.cxx|build|xcodeproj|package.json'
# ./node_modules/.bin/patch-package @onekeyfe/react-native-ble-plx --exclude 'android\/.cxx|build|xcodeproj|package.json'
# ./node_modules/.bin/patch-package react-native-ble-plx --exclude 'android\/.cxx|build|xcodeproj|package.json'
./node_modules/.bin/patch-package @onekeyfe/hd-transport-react-native --exclude 'android\/.cxx|build|xcodeproj|package.json'
