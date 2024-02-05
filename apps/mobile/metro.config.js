const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @return {import('metro-config').MetroConfig}
 */
const getAppConfig = function () {
  const config = getDefaultConfig(__dirname);

  const { resolver, transformer } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        // disable inline required on dev, avoid cycle require
        inlineRequires: process.env.NODE_ENV === 'production',
      },
    }),
  };
  config.resolver = {
    ...resolver,
    extraNodeModules: require('node-libs-react-native'),
    assetExts: resolver.assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
  };
  config.watchFolders = [
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, '../../packages'),
  ];

  return config;
};

// module.exports = mergeConfig(getDefaultConfig(__dirname), getAppConfig());
module.exports = getAppConfig();
