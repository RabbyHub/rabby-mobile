const child_process = require('child_process');
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
  const inputBuildChannel =
    process.env.buildchannel || process.env.RABBY_MOBILE_BUILD_CHANNEL;
  const resolvedBuildEnv = inputBuildEnv || 'production';
  const resolvedBuildChannel = inputBuildChannel || 'selfhost-reg';
  const shouldEnableRozenite = process.env.WITH_ROZENITE === 'true';
  const shouldStripConsole =
    inputBuildEnv === 'production' ||
    (!inputBuildEnv && ['appstore', 'selfhost'].includes(resolvedBuildChannel));
  const loadableImplExt = isDevTransform ? 'dev' : 'prod';

  api.cache.using(() =>
    JSON.stringify({
      buildChannel: resolvedBuildChannel,
      buildEnv: resolvedBuildEnv,
      callerName,
      isDevTransform,
      shouldEnableRozenite,
    }),
  );

  const buildGitInfo = (function getBuildEnvVars() {
    const NORMAL_GET_GIT_HASH = `git log --format="%H" -n1`;
    const BUILD_GIT_HASH_RAW = child_process
      .execSync(NORMAL_GET_GIT_HASH)
      .toString()
      .trim();
    const SHOULD_MARK_GIT_DIRTY =
      !!process.env.LOCAL_PACK &&
      !process.env.CI &&
      child_process.execSync('git status --porcelain').toString().trim()
        .length > 0;

    const BUILD_GIT_HASH = `${BUILD_GIT_HASH_RAW.slice(0, 8)}${
      SHOULD_MARK_GIT_DIRTY ? '-dirty' : ''
    }`;

    const BUILD_GIT_HASH_TIME =
      process.platform === 'win32'
        ? ''
        : child_process
            .execSync(
              `git show --quiet --date='format-local:%Y-%m-%dT%H:%M:%S+00:00' --format="%cd"`,
              { env: { ...process.env, TZ: 'UTC0' } },
            )
            .toString()
            .trim();

    const BUILD_TIME = new Date().toISOString();
    const BUILD_GIT_COMMITOR =
      resolvedBuildChannel !== 'selfhost-reg'
        ? ''
        : child_process
            .execSync('git show --quiet --format="%cn"')
            .toString()
            .trim();

    return {
      BUILD_GIT_HASH,
      BUILD_GIT_HASH_TIME,
      BUILD_TIME,
      BUILD_GIT_COMMITOR,
    };
  })();

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
          'process.env.BUILD_TIME':
            process.env.ZERO_AR_DATE || buildGitInfo.BUILD_TIME,
          'process.env.RABBY_MOBILE_BUILD_ENV': resolvedBuildEnv,
          'process.env.RABBY_MOBILE_STRIP_CONSOLE': shouldStripConsole
            ? 'true'
            : 'false',
          'process.env.WITH_ROZENITE': shouldEnableRozenite ? 'true' : 'false',
          'process.env.buildchannel': resolvedBuildChannel,
          'process.env.BUILD_GIT_INFO': JSON.stringify({
            BUILD_GIT_HASH: buildGitInfo.BUILD_GIT_HASH,
            BUILD_GIT_HASH_TIME: buildGitInfo.BUILD_GIT_HASH_TIME,
            BUILD_GIT_COMMITOR: buildGitInfo.BUILD_GIT_COMMITOR,
          }),
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
