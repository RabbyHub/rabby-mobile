module.exports = {
  assets: ['./assets/fonts', './assets/custom'],
  iosAssets: [],
  androidAssets: [],
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
    'react-native-quick-crypto': { platforms: { android: null } },
    'react-native-quick-base64': { platforms: { android: null } },
    'react-native-quick-bip39': { platforms: { android: null } },
  },
};
