module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/../../tests/setup.ts', '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../tests/setupAfterEnv/index.ts'],
  moduleNameMapper: {
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
    // Helper-script contracts (build cache, CI upload, Metro/architecture,
    // page assets, webview codegen) assert repository tooling, not app
    // behaviour, and several of them depend on the runner environment (proxy,
    // node/native tooling). Keep them out of the app unit-test job and run them
    // on demand next to the script they cover, e.g.
    //   node --test scripts/**/*.test.cjs
    //   yarn jest --testPathIgnorePatterns=/node_modules/ scripts/foo.test.js
    '<rootDir>/scripts/.*\\.test\\.(cjs|mjs|js)$',
  ],
  transformIgnorePatterns: [
    // `rabby-api` and `rabby-action` ship ESM-only `dist/*.js`, so tests that
    // render a screen reaching them must transform those packages too.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-root-toast|react-native-root-siblings|react-native-walkthrough-tooltip|@debank|@rabby-wallet/rabby-security-engine|@rabby-wallet/rabby-bridge|@rabby-wallet/rabby-api|@rabby-wallet/rabby-action|p-queue|p-timeout|eventemitter3|react-native-reanimated|@react-navigation)/)',
  ],
};
