module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/../../tests/setup.ts', '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../tests/setupAfterEnv/index.ts'],
  moduleNameMapper: {
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
