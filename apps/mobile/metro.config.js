const path = require('path');
const fs = require('fs');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
const { withRozenite } = require('@rozenite/metro');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');

const {
  createI18nLivePreviewSerializer,
} = require('./scripts/i18n-live-preview/metro-serializer');

const withI18nLivePreview = config => {
  if (!['1', 'true'].includes(process.env.I18N_LIVE_PREVIEW || '')) {
    return config;
  }

  return {
    ...config,
    serializer: {
      ...config.serializer,
      customSerializer: createI18nLivePreviewSerializer({
        upstreamSerializer: config.serializer?.customSerializer,
      }),
    },
  };
};

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const walletConnectKeyValueStorageShim = path.resolve(
  projectRoot,
  'src/core/walletconnect/keyvaluestorageRuntimeShim.js',
);
// Keep these exceptions explicit so resolution stays deterministic and cacheable.
const resolverSourceAliases = new Map([
  [
    '@craftzdog/react-native-buffer',
    require.resolve('@craftzdog/react-native-buffer'),
  ],
  [
    '@ledgerhq/devices/ble/receiveAPDU',
    require.resolve('@ledgerhq/devices/ble/receiveAPDU'),
  ],
  [
    '@ledgerhq/devices/ble/sendAPDU',
    require.resolve('@ledgerhq/devices/ble/sendAPDU'),
  ],
  [
    '@ledgerhq/domain-service/signers/index',
    require.resolve('@ledgerhq/domain-service/signers/index'),
  ],
  [
    '@ledgerhq/evm-tools/message/EIP712/index',
    require.resolve('@ledgerhq/evm-tools/message/EIP712/index'),
  ],
  [
    '@ledgerhq/evm-tools/message/index',
    require.resolve('@ledgerhq/evm-tools/message/index'),
  ],
  [
    '@ledgerhq/evm-tools/selectors/index',
    require.resolve('@ledgerhq/evm-tools/selectors/index'),
  ],
  ['p-queue', require.resolve('p-queue')],
  ['react-native-quick-crypto', require.resolve('react-native-quick-crypto')],
]);
const escapePathForRegex = value =>
  value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const turboBuildBlockList = new RegExp(
  [
    `${escapePathForRegex(path.resolve(projectRoot, '.turbo-build'))}\\/.*`,
    `${escapePathForRegex(path.resolve(workspaceRoot, '.turbo-build'))}\\/.*`,
  ].join('|'),
);

const LOG_FILE = path.join(__dirname, 'jsModuleId.log');

/**
 * Compose functions from right to left.
 * @param {...Function} fns - Functions to compose
 * @returns {Function} Composed function
 */
const compose =
  (...fns) =>
  x =>
    fns.reduceRight((v, f) => f(v), x);

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
 * Higher-order function to enable stable hashing configuration.
 * Returns a new config object with stable hashing settings.
 * @param {import('metro-config').MetroConfig} config - Input config (immutable)
 * @returns {import('metro-config').MetroConfig} New config with stable hashing
 */
const withStableHash = config => {
  return {
    ...config,
    serializer: {
      ...config.serializer,
      // hash 一致性时，防止 sentry 或其他来源干扰
      customSerializer: undefined,
      createModuleIdFactory,
    },
    transformer: {
      ...config.transformer,
      minifierConfig: {
        compress: {
          switches: false, // 禁用 switches 优化
        },
      },
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: false,
        },
      }),
    },
  };
};

/**
 * Higher-order function to disable package exports.
 * FIXME: upgrade dependencies to be compatible with metro's new default settings
 * @see https://github.com/expo/expo/discussions/36551
 *
 * known incompatible libraries:
 *   - @ledgerhq/hw-app-eth@6.45.0
 * @param {import('metro-config').MetroConfig} config - Input config (immutable)
 * @returns {import('metro-config').MetroConfig} New config with package exports disabled
 */
const withPackageExportsDisabled = config => {
  return {
    ...config,
    resolver: {
      ...config.resolver,
      unstable_enablePackageExports: false,
    },
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
    babelTransformerPath: require.resolve('./webview-raw-transformer'),

    // babelTransformerPath: require.resolve(
    //   'react-native-svg-transformer/react-native',
    // ),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [
      ...sourceExts,
      'svg',
      'webview.injected.js',
      'webview.injected.ts',
      'webview.injected.tsx',
    ],
    blockList: turboBuildBlockList,
    enableGlobalPackages: true,
    extraNodeModules: {
      ...require('node-libs-react-native'),
      assert: require.resolve('assert'),
      crypto: require.resolve('react-native-quick-crypto'),
      stream: require.resolve('readable-stream'),
      'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
    },
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@walletconnect/keyvaluestorage') {
        return {
          filePath: walletConnectKeyValueStorageShim,
          type: 'sourceFile',
        };
      }

      const sourceFileAlias = resolverSourceAliases.get(moduleName);
      if (sourceFileAlias) {
        return {
          filePath: sourceFileAlias,
          type: 'sourceFile',
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
  watchFolders: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'packages'),
  ],
};

const mergedConfig = compose(
  withI18nLivePreview,
  process.env.APP_ENV === 'hashing' ? withStableHash : withSentryConfig,
  wrapWithReanimatedMetroConfig,
  withPackageExportsDisabled,
)(mergeConfig(defaultConfig, config));

const rozeniteEnabled = process.env.WITH_ROZENITE === 'true';

module.exports = rozeniteEnabled
  ? withRozenite(mergedConfig, {
      enabled: true,
      include: [
        '@rozenite/react-navigation-plugin',
        '@rozenite/network-activity-plugin',
        '@rozenite/storage-plugin',
        '@rabby-wallet/rozenite-resource-flow-plugin',
      ],
    })
  : mergedConfig;
