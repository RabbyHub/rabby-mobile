module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/../../tests/setup.ts', '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../tests/setupAfterEnv/index.ts'],
  moduleNameMapper: {
    // Workspace source packages consume the app's native peers. A clean install
    // does not put those peers in each source package's node_modules directory.
    '^react$': '<rootDir>/node_modules/react',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^react-native-reanimated(/.*)?$':
      '<rootDir>/node_modules/react-native-reanimated$1',
    '^react-native-gesture-handler(/.*)?$':
      '<rootDir>/node_modules/react-native-gesture-handler$1',
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
    '<rootDir>/scripts/.*\\.test\\.cjs$',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@rneui/base|react-native-size-matters|react-native-root-toast|react-native-root-siblings|react-native-walkthrough-tooltip|@debank|@rabby-wallet/rabby-security-engine|@rabby-wallet/rabby-bridge|p-queue|p-timeout|eventemitter3)/)',
  ],
};
