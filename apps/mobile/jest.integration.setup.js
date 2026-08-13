/* eslint-env jest */

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

const { NativeModules } = require('react-native');

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-native-aes-crypto', () => ({
  decrypt: jest.fn(async value => value),
  encrypt: jest.fn(async value => value),
  pbkdf2: jest.fn(async () => 'integration-test-key'),
  randomKey: jest.fn(async () => 'integration-test-random-key'),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ data: {} })),
  },
  get: jest.fn(async () => ({ data: {} })),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  Trans: ({ children }) => children || null,
  useTranslation: () => ({
    i18n: { language: 'en' },
    ready: true,
    t: key => key,
  }),
}));

NativeModules.RNHelpers = {
  buildInfo: {},
  forceExitApp: jest.fn(),
  moveTaskToBack: jest.fn(async () => false),
  shareFile: jest.fn(async () => undefined),
  iosExcludeFileFromBackup: jest.fn(async () => true),
};

NativeModules.RNVersionCheck = {
  packageName: 'com.debank.rabbymobile.regression',
};

NativeModules.RNRabbyKeychainManager = {
  SECURITY_LEVEL_ANY: 'ANY',
  SECURITY_LEVEL_SECURE_SOFTWARE: 'SECURE_SOFTWARE',
  SECURITY_LEVEL_SECURE_HARDWARE: 'SECURE_HARDWARE',
};
