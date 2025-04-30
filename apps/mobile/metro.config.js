const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const {
  createSentryMetroSerializer,
} = require('@sentry/react-native/dist/js/tools/sentryMetroSerializer');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const {
  assetExts,
  sourceExts,
  nodeModulesPaths,
  resolveRequest: defaultModuleResolver,
} = defaultConfig.resolver;

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// 保证 module 的顺序
// https://github.com/getsentry/sentry-react-native/blob/432a4cbf65883f74c4ee6b20c1148e2c599041fe/packages/core/src/js/tools/vendor/metro/utils.ts#L60
function stableStringHash(path) {
  // 初始化参数（选用高熵值参数）
  const BASE = 257n; // 大于 ASCII 范围的质数
  const MOD = 2n ** 53n - 1n; // JS 最大安全整数
  let hash = 0n;
  for (let i = 0; i < path.length; i++) {
    const charCode = BigInt(path.charCodeAt(i));
    hash = (hash * BASE + charCode) % MOD;
  }
  return Number(hash);
}

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  projectRoot,
  transformer: {
    babelTransformerPath: require.resolve(
      'react-native-svg-transformer/react-native',
    ),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  serializer: {
    customSerializer: createSentryMetroSerializer(),
  },
  resolver: {
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    enableGlobalPackages: true,
    extraNodeModules: {
      ...require('node-libs-react-native'),
      assert: require.resolve('assert'),
      crypto: require.resolve('react-native-quick-crypto'),
      stream: require.resolve('readable-stream'),
      'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
    },
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
          paths: [path.dirname(context.originModulePath), ...nodeModulesPaths],
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
  },
  watchFolders: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'packages'),
  ],
};

module.exports = wrapWithReanimatedMetroConfig(
  mergeConfig(defaultConfig, config),
);
