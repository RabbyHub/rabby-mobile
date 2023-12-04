const pkg = require('./package.json');

const {version} = pkg;

module.exports = {
  presets: [
    [
      'module:metro-react-native-babel-preset',
      {useTransformReactJSXExperimental: true},
    ],
  ],
  plugins: [
    [
      'transform-define',
      {
        'process.env.APP_VERSION': version,
        'process.env.BUILD_TIME': new Date().toISOString(),
        'process.env.BUILD_ENV': process.env.BUILD_ENV,
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
        },
      },
    ],
    ['@babel/plugin-transform-react-jsx', {runtime: 'automatic'}],
  ],
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};
