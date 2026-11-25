/* eslint-env jest */

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

const { NativeModules } = require('react-native');

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

/**
 * Locale detection is a native module; several Perps screens read it while
 * rendering, so the integration lane needs a stable English/US answer instead
 * of the TurboModuleRegistry lookup that throws in the Jest environment.
 */
jest.mock('react-native-localize', () => ({
  getLocales: () => [
    {
      countryCode: 'US',
      languageTag: 'en-US',
      languageCode: 'en',
      isRTL: false,
    },
  ],
  getCountry: () => 'US',
  getTimeZone: () => 'Etc/UTC',
  getCalendar: () => 'gregorian',
  getTemperatureUnit: () => 'celsius',
  getFirstWeekDay: () => 1,
  uses24HourClock: () => true,
  getNumberFormatSettings: () => ({
    decimalSeparator: '.',
    groupingSeparator: ',',
    decimalSeparator2: '',
    groupingSeparator2: '',
  }),
  findBestLanguageTag: () => ({ languageTag: 'en-US', isRTL: false }),
  addEventListener: () => {},
  removeEventListener: () => {},
}));

jest.mock('react-native-aes-crypto', () => ({
  decrypt: jest.fn(async value => value),
  encrypt: jest.fn(async value => value),
  pbkdf2: jest.fn(async () => 'integration-test-key'),
  randomKey: jest.fn(async () => 'integration-test-random-key'),
}));

jest.mock('axios', () => {
  const createInterceptorManager = () => {
    const handlers = [];

    return {
      eject: jest.fn(),
      handlers,
      use: jest.fn((fulfilled, rejected) => {
        handlers.push({ fulfilled, rejected });
        return handlers.length - 1;
      }),
    };
  };
  const createClient = () => ({
    defaults: { headers: { common: {} } },
    delete: jest.fn(async () => ({ data: {} })),
    get: jest.fn(async () => ({ data: {} })),
    interceptors: {
      request: createInterceptorManager(),
      response: createInterceptorManager(),
    },
    patch: jest.fn(async () => ({ data: {} })),
    post: jest.fn(async () => ({ data: {} })),
    put: jest.fn(async () => ({ data: {} })),
    request: jest.fn(async () => ({ data: {} })),
  });
  const client = createClient();
  const axios = {
    ...client,
    create: jest.fn(createClient),
    isAxiosError: jest.fn(() => false),
  };
  return {
    __esModule: true,
    ...axios,
    default: axios,
  };
});

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
