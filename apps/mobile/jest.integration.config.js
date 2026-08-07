const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'mobile-integration',
  setupFiles: [...baseConfig.setupFiles, '<rootDir>/jest.integration.setup.js'],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^react$': '<rootDir>/node_modules/react',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^@rneui/base$': '<rootDir>/jest.integration.rneui.js',
    '^@rneui/themed$': '<rootDir>/jest.integration.rneui.js',
    '\\.svg$': '<rootDir>/jest.integration.svg.js',
    '^@rabby-wallet/biz-utils/dist/(.*)$':
      '<rootDir>/../../packages/biz-utils/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@rneui|react-native-reanimated|react-native-animateable-text|react-native-root-toast|react-native-root-siblings|p-queue|p-timeout|eventemitter3)/)',
  ],
  testMatch: ['<rootDir>/src/**/*.integration.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/'],
};
