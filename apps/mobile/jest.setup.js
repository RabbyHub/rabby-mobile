/* eslint-env jest */

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
