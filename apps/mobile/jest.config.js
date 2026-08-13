module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/../../tests/setup.ts', '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../tests/setupAfterEnv/index.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.test\\.[jt]sx?$',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-root-toast|react-native-root-siblings|p-queue|p-timeout|eventemitter3)/)',
  ],
};
