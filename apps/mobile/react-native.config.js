/** @type {import("@react-native-community/cli-types").Config} */
module.exports = {
  assets: ['./assets/fonts', './assets/custom'],
  iosAssets: [],
  androidAssets: [],
  // unstable_reactLegacyComponentNames: [],
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
    ...(process.env.NO_FLIPPER
      ? { 'react-native-flipper': { platforms: { ios: null } } }
      : {}),
  },
};
