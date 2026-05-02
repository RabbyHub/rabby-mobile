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
  const isHashingBuild = process.env.APP_ENV === 'hashing';
  const fixedHashcheckGitHash =
    process.env.RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH ||
    process.env.RABBY_MOBILE_HASHCHECK_GIT_HASH;
  const fixedHashcheckGitTime =
    process.env.RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME ||
    process.env.RABBY_MOBILE_HASHCHECK_GIT_TIME;
  const resolvedFeServiceUrl = isHashingBuild
    ? 'pesudo_for_hashing'
    : process.env.RABBY_MOBILE_FE_SERVICE_URL || '';

  api.cache.using(() =>
    JSON.stringify({
      appEnv: process.env.APP_ENV || '',
      buildChannel: resolvedBuildChannel,
      buildEnv: resolvedBuildEnv,
      callerName,
      feServiceUrl: resolvedFeServiceUrl,
      fixedHashcheckGitHash: fixedHashcheckGitHash || '',
      fixedHashcheckGitTime: fixedHashcheckGitTime || '',
      isDevTransform,
      shouldEnableRozenite,
    }),
  );

  const buildGitInfo = (function getBuildEnvVars() {
    const NORMAL_GET_GIT_HASH = `git log --format="%H" -n1`;
    const BUILD_GIT_HASH_RAW =
      isHashingBuild && fixedHashcheckGitHash
        ? fixedHashcheckGitHash
        : child_process
            .execSync(
              !process.env.LOCAL_PACK
                ? NORMAL_GET_GIT_HASH
                : `[[ -z $(git diff) || ! -z $CI ]] && (${NORMAL_GET_GIT_HASH}) || (git log --format="%H-dirty" -n 1)`,
            )
            .toString()
            .trim();

    const isDirty = BUILD_GIT_HASH_RAW.endsWith('-dirty');
    const BUILD_GIT_HASH = `${BUILD_GIT_HASH_RAW.slice(0, 8)}${
      isDirty ? '-dirty' : ''
    }`;

    const BUILD_GIT_HASH_TIME =
      isHashingBuild && fixedHashcheckGitTime
        ? fixedHashcheckGitTime
        : process.platform === 'win32'
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
      isHashingBuild || resolvedBuildChannel !== 'selfhost-reg'
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
          'process.env.RABBY_MOBILE_FE_SERVICE_URL': resolvedFeServiceUrl,
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
