const webpack = require('webpack');
const path = require('path');
const { readFileSync } = require('fs');

const PROJ_ROOT = path.resolve(__dirname, '../../../');
const REPO_ROOT = path.resolve(PROJ_ROOT, '../../');

const SVG_LOGO_PATH = path.resolve(
  REPO_ROOT,
  'apps/mobile/scripts/bundles/logo.svg',
);

function getBuildIcon() {
  const svg = readFileSync(SVG_LOGO_PATH, 'utf8');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const config = {
  entry: './index.js',

  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'inpage-content.js',
  },

  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              declaration: false,
              declarationMap: false,
              composite: false,
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.(js|jsx|mjs)$/u,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: {
                    safari: '9',
                    chrome: '60',
                  },
                },
              ],
            ],
          },
        },
      },
    ],
  },
  resolve: {
    fallback: {
      buffer: require.resolve('buffer'),
      stream: require.resolve('stream-browserify'),
      _stream_transform: require.resolve(
        'readable-stream/lib/_stream_transform',
      ),
      _stream_readable: require.resolve('readable-stream/lib/_stream_readable'),
      _stream_writable: require.resolve('readable-stream/lib/_stream_writable'),
      _stream_duplex: require.resolve('readable-stream/lib/_stream_duplex'),
      _stream_passthrough: require.resolve(
        'readable-stream/lib/_stream_passthrough',
      ),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    new webpack.DefinePlugin({
      'process.env.RABBY_BUILD_NAME': JSON.stringify('Rabby Wallet'),
      'process.env.RABBY_BUILD_ICON': JSON.stringify(getBuildIcon()),
      'process.env.RABBY_BUILD_APP_ID': JSON.stringify(
        'com.debank.rabbymobile',
      ),
    }),
  ],
};

module.exports = (_env, argv) => {
  if (argv.mode === 'development') {
    config.mode = 'development';
  }
  return config;
};
