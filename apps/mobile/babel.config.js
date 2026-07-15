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
  const shouldUseMetroCache = ['1', 'true'].includes(
    (process.env.RABBY_MOBILE_METRO_USE_CACHE || '').toLowerCase(),
  );
  const shouldStripConsole =
    inputBuildEnv === 'production' ||
    (!inputBuildEnv && ['appstore', 'selfhost'].includes(resolvedBuildChannel));
  const loadableImplExt = isDevTransform ? 'dev' : 'prod';

  api.cache.using(() =>
    JSON.stringify({
      buildChannel: resolvedBuildChannel,
      buildEnv: resolvedBuildEnv,
      dotenvEnv: process.env.APP_ENV || '',
      callerName,
      isDevTransform,
      shouldEnableRozenite,
      shouldUseMetroCache,
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
          'process.env.WITH_ROZENITE': shouldEnableRozenite ? 'true' : 'false',
          'process.env.buildchannel': resolvedBuildChannel,
          'process.env.RABBY_MOBILE_FE_SERVICE_URL':
            process.env.RABBY_MOBILE_FE_SERVICE_URL || '',
          'process.env.RABBY_MOBILE_METRO_USE_CACHE': shouldUseMetroCache
            ? 'true'
            : 'false',
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
            ...(loadableAliases[loadableImplExt] || {}),
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
