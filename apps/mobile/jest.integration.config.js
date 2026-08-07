const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'mobile-integration',
  testMatch: ['<rootDir>/src/**/*.integration.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/'],
};
