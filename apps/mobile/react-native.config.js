/**
 * @type {import('@react-native-community/cli-types').Config}
 */
module.exports = {
  assets: ['./assets/fonts', './assets/custom'],
  iosAssets: [
    // './assets/android/builtin-pages'
  ],
  androidAssets: [
    // './assets/ios/builtin-pages'
  ],
  dependencies: {
    'react-native-ios-context-menu': {
      platforms: {
        android: null,
      },
    },
    '@react-native-menu/menu': {
      platforms: {
        ios: null,
      },
    },
    '@rabby-wallet/react-native-keychain': {
      platforms: {
        android: {
          packageImportPath:
            'import com.rabbywallet.keychain.RabbyKeychainPackage;',
          packageInstance: 'new RabbyKeychainPackage()',
        },
      },
    },
    ...(process.env.NO_FLIPPER
      ? { 'react-native-flipper': { platforms: { ios: null } } }
      : {}),
  },
};
