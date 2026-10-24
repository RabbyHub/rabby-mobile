module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/../../tests/setup.ts', '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../tests/setupAfterEnv/index.ts'],
  // Workspace source packages consume the app's native peers. A clean install
  // does not put those peers in each source package's node_modules directory.
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^react-native-reanimated(/.*)?$':
      '<rootDir>/node_modules/react-native-reanimated$1',
    '^react-native-gesture-handler(/.*)?$':
      '<rootDir>/node_modules/react-native-gesture-handler$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.test\\.[jt]sx?$',
    // Build-script contracts use node:test and the project's Ruby toolchain.
    '<rootDir>/scripts/.*\\.test\\.cjs$',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@rneui/base|react-native-size-matters|react-native-root-toast|react-native-root-siblings|react-native-walkthrough-tooltip|@rabby-wallet/rabby-security-engine|p-queue|p-timeout|eventemitter3)/)',
  ],
};
