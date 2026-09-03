const {
  isLegacyReactNativeArchitecture,
} = require('./scripts/react-native-architecture.cjs');

const isLegacyArchitecture = isLegacyReactNativeArchitecture();

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
    'react-native-mmkv': isLegacyArchitecture
      ? { platforms: { android: null, ios: null } }
      : {},
    'react-native-mmkv-legacy': isLegacyArchitecture
      ? {}
      : { platforms: { android: null, ios: null } },
    '@rabby-wallet/react-native-ios-context-menu': {
      platforms: {
        android: null,
      },
    },
    '@rabby-wallet/react-native-menu': {
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
    '@rabby-wallet/react-native-keychain-9': {
      platforms: {
        android: {
          packageImportPath:
            'import com.rabbywallet.keychain9.RabbyKeychainV9Package;',
          packageInstance: 'new RabbyKeychainV9Package()',
        },
      },
    },
    ...(process.env.NO_FLIPPER
      ? { 'react-native-flipper': { platforms: { ios: null } } }
      : {}),
  },
};
