const child_process = require('child_process');
const pkg = require('./package.json');

const { version } = pkg;

const buildGitInfo = (function getBuildEnvVars() {
  const NORMAL_GET_GIT_HASH = `git log --format="%H" -n1`;
  const BUILD_GIT_HASH_RAW = child_process
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

  const buildchannel = process.env.buildchannel || 'selfhost-reg';

  const BUILD_GIT_COMMITOR =
    buildchannel !== 'selfhost-reg'
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

module.exports = {
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
        'process.env.RABBY_MOBILE_BUILD_ENV':
          process.env.RABBY_MOBILE_BUILD_ENV || 'production',
        'process.env.buildchannel':
          process.env.buildchannel ||
          process.env.RABBY_MOBILE_BUILD_CHANNEL ||
          'selfhost-reg',
        'process.env.BUILD_GIT_INFO': JSON.stringify({
          BUILD_GIT_HASH: buildGitInfo.BUILD_GIT_HASH,
          BUILD_GIT_HASH_TIME: buildGitInfo.BUILD_GIT_HASH_TIME,
          BUILD_GIT_COMMITOR: buildGitInfo.BUILD_GIT_COMMITOR,
        }),
        'process.env.RABBY_MOBILE_SAFE_API_KEY':
          process.env.RABBY_MOBILE_SAFE_API_KEY ||
          process.env.MOBILE_SAFE_API_KEY,
        'process.env.RABBY_MOBILE_PUSH_TEST_SERVER_URL':
          process.env.RABBY_MOBILE_PUSH_TEST_SERVER_URL || '',
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
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};
