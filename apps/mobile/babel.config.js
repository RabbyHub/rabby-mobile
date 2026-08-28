const pkg = require('./package.json');
const loadableAliases = require('./scripts/loadables-aliases.generated.cjs');

/** @type {import('@babel/core').ConfigFunction} */
module.exports = api => {
  const callerName = api.caller(caller => caller?.name) || '';
  const callerDev = api.caller(caller => caller?.dev);
  const isDevTransform =
    typeof callerDev === 'boolean'
      ? callerDev
      : process.env.BABEL_ENV === 'development' ||
        process.env.NODE_ENV === 'development';
  const isJestTransform = callerName === 'babel-jest';

  const { version } = pkg;
  const inputBuildEnv = process.env.RABBY_MOBILE_BUILD_ENV;
  if (!process.env.APP_ENV && inputBuildEnv) {
    process.env.APP_ENV = inputBuildEnv;
  }
  const inputBuildChannel =
    process.env.buildchannel || process.env.RABBY_MOBILE_BUILD_CHANNEL;
  const resolvedBuildEnv = inputBuildEnv || 'production';
  const resolvedBuildChannel = inputBuildChannel || 'selfhost-reg';
  const shouldEnableRozenite = process.env.WITH_ROZENITE === 'true';
  const shouldStripConsole =
    inputBuildEnv === 'production' ||
    (!inputBuildEnv && ['appstore', 'selfhost'].includes(resolvedBuildChannel));
  const moduleLoadingMode =
    process.env.RABBY_MOBILE_MODULE_LOADING_MODE || 'lazy';
  if (!['eager', 'lazy'].includes(moduleLoadingMode)) {
    throw new Error(
      `Unsupported RABBY_MOBILE_MODULE_LOADING_MODE: ${moduleLoadingMode}`,
    );
  }
  const shouldInlineDevDynamicImports =
    isDevTransform && moduleLoadingMode === 'lazy';
  const regressionScenarioImplExt =
    isDevTransform || resolvedBuildChannel === 'selfhost-reg'
      ? 'nonprod'
      : 'prod';
  const localStorageExportInput =
    process.env.RABBY_MOBILE_ENABLE_LOCAL_STORAGE_EXPORT;
  if (
    localStorageExportInput &&
    !['true', 'false'].includes(localStorageExportInput)
  ) {
    throw new Error(
      `Unsupported RABBY_MOBILE_ENABLE_LOCAL_STORAGE_EXPORT: ${localStorageExportInput}`,
    );
  }
  const shouldEnableLocalStorageExport = localStorageExportInput
    ? localStorageExportInput === 'true'
    : isDevTransform || resolvedBuildEnv !== 'production';

  api.cache.using(() =>
    JSON.stringify({
      buildChannel: resolvedBuildChannel,
      buildEnv: resolvedBuildEnv,
      dotenvEnv: process.env.APP_ENV || '',
      callerName,
      isDevTransform,
      moduleLoadingMode,
      regressionScenarioImplExt,
      shouldEnableRozenite,
      shouldEnableLocalStorageExport,
      shouldInlineDevDynamicImports,
    }),
  );

  return {
    presets: [
      [
        '@react-native/babel-preset',
        {
          runtime: 'automatic',
          reactTransform: true,
        },
      ],
    ],
    plugins: [
      [
        'transform-define',
        {
          'process.env.APP_VERSION': version,
          'process.env.RABBY_MOBILE_BUILD_ENV': resolvedBuildEnv,
          'process.env.RABBY_MOBILE_STRIP_CONSOLE': shouldStripConsole
            ? 'true'
            : 'false',
          'process.env.RABBY_MOBILE_MODULE_LOADING_MODE': moduleLoadingMode,
          'process.env.RABBY_MOBILE_ENABLE_LOCAL_STORAGE_EXPORT':
            shouldEnableLocalStorageExport ? 'true' : 'false',
          'process.env.WITH_ROZENITE': shouldEnableRozenite ? 'true' : 'false',
          'process.env.buildchannel': resolvedBuildChannel,
          'process.env.RABBY_MOBILE_FE_SERVICE_URL':
            process.env.RABBY_MOBILE_FE_SERVICE_URL || '',
        },
      ],
      [
        'module-resolver',
        {
          root: ['.'],
          extensions: [
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
            '.android.js',
            '.android.tsx',
            '.ios.js',
            '.ios.tsx',
          ],
          alias: {
            '^@/devtools/regressionScenarios/entry$': `./src/devtools/regressionScenarios/entry.${regressionScenarioImplExt}`,
            '^@/devtools/regressionScenarios/runtime$': `./src/devtools/regressionScenarios/runtime.${regressionScenarioImplExt}`,
            '^@/devtools/regressionScenarios/react$': `./src/devtools/regressionScenarios/react.${regressionScenarioImplExt}`,
            '^@/hooks/useFeatureActivationDiagnostics$': `./src/hooks/useFeatureActivationDiagnostics.${regressionScenarioImplExt}`,
            '^@/startup/moduleLoading/launchTaskLoaders$': `./src/startup/moduleLoading/launchTaskLoaders.${moduleLoadingMode}`,
            '^@/startup/moduleLoading/setupRuntimeLoaders$': `./src/startup/moduleLoading/setupRuntimeLoaders.${moduleLoadingMode}`,
            ...(loadableAliases[moduleLoadingMode] || {}),
            '@': './src',
            'styled-components/native': 'styled-components/native',
            'styled-components': 'styled-components/native',
          },
        },
      ],
      ['@babel/plugin-transform-export-namespace-from'],

      ['module:react-native-dotenv', { moduleName: '@env' }],
      ['nativewind/babel', {}],
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-static-block'],
      ...(isJestTransform || shouldInlineDevDynamicImports
        ? ['@babel/plugin-transform-dynamic-import']
        : []),
      ['react-native-reanimated/plugin'],
    ],
    ...(shouldStripConsole
      ? {
          env: {
            production: {
              plugins: ['transform-remove-console'],
            },
          },
        }
      : {}),
  };
};
