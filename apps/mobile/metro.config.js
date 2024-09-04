const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const {
  createSentryMetroSerializer,
} = require('@sentry/react-native/dist/js/tools/sentryMetroSerializer');

const defaultModuleResolver =
  getDefaultConfig(__dirname).resolver.resolveRequest;

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @return {import('metro-config').MetroConfig}
 */
const getAppConfig = function () {
  const config = getDefaultConfig(__dirname);

  const { resolver, transformer, serializer } = config;

  config.serializer = {
    ...serializer,
    customSerializer: createSentryMetroSerializer(),
  };

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  };
  config.resolver = {
    ...resolver,
    extraNodeModules: require('node-libs-react-native'),
    assetExts: resolver.assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
    /**
     * fix ledger import issue
     * https://github.com/LedgerHQ/ledger-live/issues/6173#issuecomment-2008939013
     *
     * */
    resolveRequest: (context, moduleName, platform) => {
      try {
        return context.resolveRequest(context, moduleName, platform);
      } catch (error) {
        console.warn(
          '\n1️⃣ context.resolveRequest cannot resolve: ',
          moduleName,
        );
      }

      try {
        const resolution = require.resolve(moduleName, {
          paths: [
            path.dirname(context.originModulePath),
            ...config.resolver.nodeModulesPaths,
          ],
        });

        if (path.isAbsolute(resolution)) {
          return {
            filePath: resolution,
            type: 'sourceFile',
          };
        }
      } catch (error) {
        console.warn('\n2️⃣ require.resolve cannot resolve: ', moduleName);
      }

      try {
        return defaultModuleResolver(context, moduleName, platform);
      } catch (error) {
        console.warn('\n3️⃣ defaultModuleResolver cannot resolve: ', moduleName);
      }

      try {
        return {
          filePath: require.resolve(moduleName),
          type: 'sourceFile',
        };
      } catch (error) {
        console.warn('\n4️⃣ require.resolve cannot resolve: ', moduleName);
      }

      try {
        const resolution = getDefaultConfig(require.resolve(moduleName))
          .resolver?.resolveRequest;
        return resolution(context, moduleName, platform);
      } catch (error) {
        console.warn('\n5️⃣ getDefaultConfig cannot resolve: ', moduleName);
      }
    },
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
