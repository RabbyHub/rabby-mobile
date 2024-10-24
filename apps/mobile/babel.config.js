const child_process = require('child_process');

const pkg = require('./package.json');

const BUILD_GIT_HASH = child_process
  .execSync('git log --format="%h" -n 1')
  .toString()
  .trim();

const { version } = pkg;

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
        'process.env.BUILD_GIT_HASH': BUILD_GIT_HASH,
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
