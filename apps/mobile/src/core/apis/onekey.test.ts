function setupApiOneKeyModule() {
  jest.resetModules();

  const mockKeyring = {};
  const mockGetKeyring = jest.fn(async () => mockKeyring);
  const mockBindOneKeyEvents = jest.fn();

  jest.doMock('@rabby-wallet/keyring-utils', () => ({
    KEYRING_TYPE: {
      OneKeyKeyring: 'OneKey Keyring',
    },
  }));
  jest.doMock('./keyring', () => ({
    getKeyring: mockGetKeyring,
  }));
  jest.doMock('@/utils/onekey', () => ({
    bindOneKeyEvents: mockBindOneKeyEvents,
  }));
  jest.doMock('../services/shared', () => ({
    keyringService: {},
    preferenceService: {},
  }));
  jest.doMock('@onekeyfe/hd-ble-sdk', () => ({
    __esModule: true,
    default: {
      on: jest.fn(),
    },
  }));
  jest.doMock('@onekeyfe/hd-core', () => ({
    DEVICE: {
      CONNECT: 'CONNECT',
      DISCONNECT: 'DISCONNECT',
    },
  }));
  jest.doMock('../utils/reexports', () => ({
    zCreate: jest.fn(initializer => {
      let state = initializer();
      const store = jest.fn(selector => selector(state));
      store.setState = (updater: any) => {
        state = updater(state);
      };
      return store;
    }),
  }));
  jest.doMock('../utils/store', () => ({
    resolveValFromUpdater: jest.fn((prev, valOrFunc) => ({
      newVal: typeof valOrFunc === 'function' ? valOrFunc(prev) : valOrFunc,
    })),
  }));

  const apiOneKey = require('./onekey') as typeof import('./onekey');

  return {
    ...apiOneKey,
    mockKeyring,
    mockGetKeyring,
    mockBindOneKeyEvents,
  };
}

describe('core/apis/onekey', () => {
  afterEach(() => {
    jest.dontMock('@rabby-wallet/keyring-utils');
    jest.dontMock('./keyring');
    jest.dontMock('@/utils/onekey');
    jest.dontMock('../services/shared');
    jest.dontMock('@onekeyfe/hd-ble-sdk');
    jest.dontMock('@onekeyfe/hd-core');
    jest.dontMock('../utils/reexports');
    jest.dontMock('../utils/store');
  });

  it('binds OneKey events for the keyring returned by getKeyring', async () => {
    const {
      initOneKeyKeyring,
      mockKeyring,
      mockGetKeyring,
      mockBindOneKeyEvents,
    } = setupApiOneKeyModule();

    const result = await initOneKeyKeyring();

    expect(result).toBe(mockKeyring);
    expect(mockGetKeyring).toHaveBeenCalledWith('OneKey Keyring');
    expect(mockBindOneKeyEvents).toHaveBeenCalledWith(mockKeyring);
  });
});
