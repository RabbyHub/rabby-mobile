module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/../../tests/setup.ts', '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../tests/setupAfterEnv/index.ts'],
};
