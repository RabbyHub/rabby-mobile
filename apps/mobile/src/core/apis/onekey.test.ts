function setupApiOneKeyModule() {
  jest.resetModules();

  const mockKeyring = {
    bridge: {
      searchDevices: jest.fn(async () => ({
        success: true,
        payload: [],
      })),
    },
    getAccountInfo: jest.fn(() => ({
      connectId: 'connect-id',
    })),
    getAddresses: jest.fn(),
    getCurrentAccounts: jest.fn(),
    fixConnectId: jest.fn(),
    setAccountToUnlock: jest.fn(),
    setDeviceConnectId: jest.fn(),
    trySearchDevice: jest.fn(async () => undefined),
    unlock: jest.fn(),
    cleanUp: jest.fn(),
  };
  const mockGetKeyring = jest.fn(async () => mockKeyring);
  const mockBindOneKeyEvents = jest.fn();
  const mockAddNewAccount = jest.fn();
  const mockInitCurrentAccount = jest.fn();
  const mockPersistKeyringsForKeyring = jest.fn();

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
    keyringService: {
      addNewAccount: mockAddNewAccount,
      persistKeyringsForKeyring: mockPersistKeyringsForKeyring,
    },
    preferenceService: {
      initCurrentAccount: mockInitCurrentAccount,
    },
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
    mockAddNewAccount,
    mockInitCurrentAccount,
    mockPersistKeyringsForKeyring,
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

  it('binds OneKey events before scanning devices', async () => {
    const { searchDevices, mockKeyring, mockBindOneKeyEvents } =
      setupApiOneKeyModule();

    await searchDevices();

    expect(mockBindOneKeyEvents).toHaveBeenCalledWith(mockKeyring);
    expect(mockKeyring.bridge.searchDevices).toHaveBeenCalled();
  });

  it('binds OneKey events before unlocking the device', async () => {
    const { unlockDevice, mockKeyring, mockBindOneKeyEvents } =
      setupApiOneKeyModule();

    await unlockDevice();

    expect(mockBindOneKeyEvents).toHaveBeenCalledWith(mockKeyring);
    expect(mockKeyring.unlock).toHaveBeenCalled();
  });

  it('binds OneKey events before importing an address', async () => {
    const {
      importAddress,
      mockKeyring,
      mockBindOneKeyEvents,
      mockAddNewAccount,
      mockInitCurrentAccount,
    } = setupApiOneKeyModule();

    await importAddress(0);

    expect(mockBindOneKeyEvents).toHaveBeenCalledWith(mockKeyring);
    expect(mockKeyring.setAccountToUnlock).toHaveBeenCalledWith('0');
    expect(mockAddNewAccount).toHaveBeenCalledWith(mockKeyring);
    expect(mockInitCurrentAccount).toHaveBeenCalled();
  });
});
