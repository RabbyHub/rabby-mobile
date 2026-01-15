const path = require('path');
const fs = require('fs');
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

const LOG_FILE = path.join(__dirname, 'jsModuleId.log');

// 保证 module 的顺序
// https://github.com/facebook/metro/blob/d7c74eac8d277ea321a0b81336732764cc0b7e1f/packages/metro/src/lib/createModuleIdFactory.js#L14
const createModuleIdFactory = () => {
  const projPathReg = new RegExp(`^${path.resolve(__dirname, '../..')}/`);

  return function stableStringHash(pathStr) {
    // 初始化参数（选用高熵值参数）
    const BASE = 257n; // 大于 ASCII 范围的质数
    const MOD = 2n ** 53n - 1n; // JS 最大安全整数
    let hash = 0n;
    const _path = pathStr.replace(projPathReg, 'root/');

    for (let i = 0; i < _path.length; i++) {
      // eslint-disable-next-line no-undef
      const charCode = BigInt(_path.charCodeAt(i));
      hash = (hash * BASE + charCode) % MOD;
    }

    const result = Number(hash);
    // 日志记录逻辑
    const logEntry = `${_path}\t${result}\n`;
    try {
      fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
    } catch (err) {
      console.error('写入日志失败:', err);
    }
    return result;
  };
};

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
        inlineRequires: true,
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

if (process.env.APP_ENV === 'hashing') {
  // hash 一致性时，防止 sentry 干扰
  delete config.serializer.customSerializer;

  config.serializer.createModuleIdFactory = createModuleIdFactory;

  config.transformer.minifierConfig = {
    compress: {
      switches: false, // 禁用 switches 优化
    },
  };

  config.transformer.getTransformOptions = async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: false,
    },
  });
}

module.exports = wrapWithReanimatedMetroConfig(
  mergeConfig(defaultConfig, config),
);
