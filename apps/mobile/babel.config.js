const child_process = require('child_process');

const pkg = require('./package.json');

const { version } = pkg;

const buildGitInfo = (function getBuildEnvVars() {
  const BUILD_GIT_HASH = child_process
    .execSync('git log --format="%h" -n 1')
    .toString()
    .trim();

  const BUILD_GIT_HASH_TIME = child_process
    .execSync(
      `TZ=UTC0 git show --quiet --date='format-local:%Y-%m-%dT%H:%M:%S+00:00' --format="%cd"`,
    )
    .toString()
    .trim();

  const buildchannel = process.env.buildchannel || 'selfhost-reg';

  const BUILD_GIT_COMMITOR =
    buildchannel !== 'selfhost-reg'
      ? ''
      : child_process
          // format: name
          .execSync('git show --quiet --format="%cn"')
          // // format: name(email)
          // .execSync('git log -1 --pretty=format:"%an(%ae)"')
          .toString()
          .trim();

  const BUILD_GIT_COMMITS_COUNT_BASEVER = version;

  // calculate commits count from v{version}
  const BUILD_GIT_COMMITS_COUNT = child_process
    .execSync(`git rev-list --count v${BUILD_GIT_COMMITS_COUNT_BASEVER}..HEAD`)
    .toString()
    .trim();

  return {
    BUILD_GIT_HASH,
    BUILD_GIT_HASH_TIME,
    BUILD_GIT_COMMITOR,
    BUILD_GIT_COMMITS_COUNT,
    BUILD_GIT_COMMITS_COUNT_BASEVER,
  };
})();

module.exports = {
  presets: [
    [
      'module:metro-react-native-babel-preset',
      { useTransformReactJSXExperimental: true },
    ],
  ],
  plugins: [
    [
      'transform-define',
      {
        'process.env.APP_VERSION': version,
        'process.env.BUILD_TIME': new Date().toISOString(),
        'process.env.BUILD_ENV': process.env.BUILD_ENV || 'production',
        'process.env.buildchannel': process.env.buildchannel || 'selfhost-reg',
        'process.env.BUILD_GIT_INFO': JSON.stringify({
          BUILD_GIT_HASH: buildGitInfo.BUILD_GIT_HASH,
          BUILD_GIT_HASH_TIME: buildGitInfo.BUILD_GIT_HASH_TIME,
          BUILD_GIT_COMMITOR: buildGitInfo.BUILD_GIT_COMMITOR,
          BUILD_GIT_COMMITS_COUNT: buildGitInfo.BUILD_GIT_COMMITS_COUNT,
          BUILD_GIT_COMMITS_COUNT_BASEVER:
            buildGitInfo.BUILD_GIT_COMMITS_COUNT_BASEVER,
        }),
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

          // 'crypto': 'react-native-quick-crypto',
          // // 'stream': 'stream-browserify',
          // 'stream': 'readable-stream',
          // 'buffer': '@craftzdog/react-native-buffer',
        },
      },
    ],
    ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
    ['@babel/plugin-transform-export-namespace-from'],
    'react-native-reanimated/plugin',
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
      },
    ],
    [
      'nativewind/babel',
      {
        // mode: "transformOnly",
        // mode: "compileOnly",
      },
    ],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    // ['@babel/plugin-transform-flow-strip-types', { loose: true }],
    // ['@babel/plugin-proposal-class-properties', { loose: true }],
    // ['@babel/plugin-proposal-private-methods', { loose: true }],
  ],
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};
