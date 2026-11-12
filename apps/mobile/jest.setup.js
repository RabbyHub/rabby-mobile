/* eslint-env jest */

require('react-native-gesture-handler/jestSetup');

// `src/constant/index.ts` reads NativeModules.RNVersionCheck.packageName at
// import time, so any suite that renders a real screen needs a stub.
{
  const { NativeModules } = require('react-native');
  if (!NativeModules.RNVersionCheck) {
    NativeModules.RNVersionCheck = {
      packageName: 'com.debank.rabby-mobile',
      versionName: '0.0.0',
      buildNumber: '0',
    };
  }
}

const createScope = () => ({
  setTag: jest.fn(),
  setTags: jest.fn(),
  setExtra: jest.fn(),
  setExtras: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  setLevel: jest.fn(),
  setFingerprint: jest.fn(),
});

// NetInfo throws at import time when its native module is absent.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// Native-only modules that are pulled in through shared re-exports. They are
// absent from the Jest runtime, so keep their import-time side effects out of
// every test suite instead of making each test re-declare the same mocks.
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-native-aes-crypto', () => ({
  __esModule: true,
  default: {
    randomKey: jest.fn(async () => 'mock-random-key'),
    pbkdf2: jest.fn(async () => 'mock-derived-key'),
    encrypt: jest.fn(async () => 'mock-cipher'),
    decrypt: jest.fn(async () => 'mock-plaintext'),
  },
}));

jest.mock('@/core/native/RNHelpers', () => ({
  __esModule: true,
  default: {
    forceExitApp: jest.fn(),
    measureViewRelativeTo: jest.fn(),
    buildInfo: {},
    setSensitiveClipboard: jest.fn(),
    moveTaskToBack: jest.fn(),
    shareFile: jest.fn(),
    iosExcludeFileFromBackup: jest.fn(),
  },
}));

jest.mock('react-native-mmkv', () => {
  const stores = new Map();

  const getStore = id => {
    if (!stores.has(id)) {
      stores.set(id, {
        values: new Map(),
        listeners: new Set(),
      });
    }

    return stores.get(id);
  };

  class MMKV {
    constructor(config = {}) {
      this.id = config.id || 'default';
      this.store = getStore(this.id);
    }

    notify = key => {
      this.store.listeners.forEach(listener => listener(key));
    };

    set = (key, value) => {
      this.store.values.set(key, value);
      this.notify(key);
    };

    getString = key => {
      const value = this.store.values.get(key);
      return typeof value === 'string' ? value : null;
    };

    getNumber = key => {
      const value = this.store.values.get(key);
      return typeof value === 'number' ? value : null;
    };

    getBoolean = key => {
      const value = this.store.values.get(key);
      return typeof value === 'boolean' ? value : null;
    };

    getAllKeys = () => Array.from(this.store.values.keys());

    contains = key => this.store.values.has(key);

    delete = key => {
      this.store.values.delete(key);
      this.notify(key);
    };

    clearAll = () => {
      this.store.values.clear();
    };

    trim = jest.fn();

    addOnValueChangedListener = listener => {
      this.store.listeners.add(listener);
      return {
        remove: () => this.store.listeners.delete(listener),
      };
    };
  }

  return { MMKV };
});

jest.mock('@sentry/react-native', () => {
  const scope = createScope();

  return {
    __esModule: true,
    init: jest.fn(),
    captureException: jest.fn((error, callback) => {
      if (typeof callback === 'function') {
        callback(scope);
      }
      return 'mock-event-id';
    }),
    captureMessage: jest.fn(() => 'mock-event-id'),
    captureEvent: jest.fn(() => 'mock-event-id'),
    addBreadcrumb: jest.fn(),
    addIntegration: jest.fn(),
    breadcrumbsIntegration: jest.fn(options => ({
      name: 'Breadcrumbs',
      options,
    })),
    configureScope: jest.fn(callback => {
      if (typeof callback === 'function') {
        callback(scope);
      }
    }),
    withScope: jest.fn(callback => {
      if (typeof callback === 'function') {
        callback(scope);
      }
    }),
    setContext: jest.fn(),
    setExtra: jest.fn(),
    setExtras: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
    setUser: jest.fn(),
    addEventProcessor: jest.fn(),
    getCurrentScope: jest.fn(() => scope),
    getGlobalScope: jest.fn(() => scope),
    getIsolationScope: jest.fn(() => scope),
    getClient: jest.fn(() => null),
    setCurrentClient: jest.fn(),
    lastEventId: jest.fn(() => 'mock-event-id'),
    startInactiveSpan: jest.fn(),
    startSpan: jest.fn(),
    startSpanManual: jest.fn(),
    getActiveSpan: jest.fn(),
    getRootSpan: jest.fn(),
    withActiveSpan: jest.fn(),
    suppressTracing: jest.fn(),
    spanToJSON: jest.fn(),
    spanIsSampled: jest.fn(),
    setMeasurement: jest.fn(),
    Scope: jest.fn(),
  };
});
