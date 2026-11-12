module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/../../tests/setup.ts', '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../tests/setupAfterEnv/index.ts'],
  moduleNameMapper: {
    // Metro transforms SVG imports into components; Jest needs the same module
    // shape without pulling the native SVG runtime into every suite.
    '\\.svg$': '<rootDir>/jest.svgMock.js',
    // The package exposes only "." in package.json; Metro resolves this deep
    // import, while Jest enforces package exports.
    '^@rabby-wallet/biz-utils/(.*)$': '<rootDir>/../../packages/biz-utils/$1',
    // @scure/bip39's patch require()s these. Unit tests never load the native modules.
    '^react-native-quick-crypto$':
      '<rootDir>/../../packages/service-keyring/test/react-native-quick-crypto.mock.js',
    '^@craftzdog/react-native-buffer$':
      '<rootDir>/../../packages/service-keyring/test/react-native-buffer.mock.js',
    // rabby-bridge only declares an ESM export, so map around package exports.
    '^@rabby-wallet/rabby-bridge$':
      '<rootDir>/node_modules/@rabby-wallet/rabby-bridge/dist/index.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.test\\.[jt]sx?$',
    // Build-script contracts use node:test and the project's Ruby toolchain.
    '<rootDir>/scripts/.*\\.test\\.(cjs|mjs)$',
  ],
  transformIgnorePatterns: [
    // `rabby-api` and `rabby-action` ship ESM-only `dist/*.js`, so tests that
    // render a screen reaching them must transform those packages too.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-root-toast|react-native-root-siblings|react-native-walkthrough-tooltip|@debank|@rabby-wallet/rabby-security-engine|@rabby-wallet/rabby-bridge|@rabby-wallet/rabby-api|@rabby-wallet/rabby-action|p-queue|p-timeout|eventemitter3)/)',
  ],
};
