module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/vendor/**/*',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'json-summary', 'text'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  preset: 'ts-jest',
  // "resetMocks" resets all mocks, including mocked modules, to jest.fn(),
  // between each test case.
  resetMocks: true,
  // "restoreMocks" restores all mocks created using jest.spyOn to their
  // original implementations, between each test. It does not affect mocked
  // modules.
  restoreMocks: true,
  projects: [
    {
      displayName: 'Runner: default',
      preset: 'ts-jest',
      testRegex: ['\\.test\\.(ts|js)$'],
      testPathIgnorePatterns: [
        '<rootDir>/src/WebWorker/*',
        '<rootDir>/src/window/*',
      ],
    },
    // {
    //   displayName: 'Runner: Electron',
    //   preset: 'ts-jest',
    //   runner: '@jest-runner/electron',
    //   testEnvironment: '@jest-runner/electron/environment',
    //   testMatch: [
    //     '<rootDir>/src/WebWorker/*.test.ts',
    //     '<rootDir>/src/window/*.test.ts',
    //   ],
    // },
  ],
  testTimeout: 2500,
};
