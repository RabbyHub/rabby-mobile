function setupApiOneKeyModule() {
  jest.resetModules();

  const mockKeyring = {
    init: jest.fn(async () => undefined),
    connectId: null as string | null,
    _deviceConnectId: undefined as string | undefined,
    bridge: {
      searchDevices: jest.fn(
        async (): Promise<any> => ({
          success: true,
          payload: [],
        }),
      ),
      cancel: jest.fn(),
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
  jest.doMock('@/core/serviceApi/keyring', () => ({
    keyringServiceApi: {
      addNewAccount: mockAddNewAccount,
      persistKeyringsForKeyring: mockPersistKeyringsForKeyring,
    },
  }));
  jest.doMock('@/core/serviceApi/preference', () => ({
    preferenceServiceApi: {
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
    jest.dontMock('@/core/serviceApi/keyring');
    jest.dontMock('@/core/serviceApi/preference');
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

    await searchDevices({ maxAttempts: 1 });

    expect(mockBindOneKeyEvents).toHaveBeenCalledWith(mockKeyring);
    expect(mockKeyring.bridge.searchDevices).toHaveBeenCalled();
  });

  it('waits for SDK initialization before scanning and retries a failed initialization', async () => {
    const { searchDevices, mockKeyring } = setupApiOneKeyModule();
    mockKeyring.init.mockRejectedValueOnce(new Error('Initialization failed'));
    await expect(searchDevices({ maxAttempts: 1 })).rejects.toThrow(
      'Initialization failed',
    );
    expect(mockKeyring.bridge.searchDevices).not.toHaveBeenCalled();

    let ready!: () => void;
    mockKeyring.init.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          ready = resolve;
        }),
    );
    const scan = searchDevices({ maxAttempts: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockKeyring.bridge.searchDevices).not.toHaveBeenCalled();
    ready();
    await expect(scan).resolves.toEqual({ success: true, payload: [] });
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

  describe('searchDevices', () => {
    const device = { connectId: 'ble-1', name: 'Pro 2 ABCD' };

    it('scans again while nothing is found and stops at the first hit', async () => {
      const { searchDevices, mockKeyring } = setupApiOneKeyModule();
      mockKeyring.bridge.searchDevices
        .mockResolvedValueOnce({ success: true, payload: [] })
        .mockResolvedValueOnce({ success: true, payload: [device] });

      const res = await searchDevices({ retryDelayMs: 0 });

      expect(res).toEqual({ success: true, payload: [device] });
      expect(mockKeyring.bridge.searchDevices).toHaveBeenCalledTimes(2);
    });

    it('gives up with an empty list after maxAttempts', async () => {
      const { searchDevices, mockKeyring } = setupApiOneKeyModule();

      const res = await searchDevices({ maxAttempts: 3, retryDelayMs: 0 });

      expect(res).toEqual({ success: true, payload: [] });
      expect(mockKeyring.bridge.searchDevices).toHaveBeenCalledTimes(3);
    });

    it('retries a transient scan error', async () => {
      const { searchDevices, mockKeyring } = setupApiOneKeyModule();
      mockKeyring.bridge.searchDevices
        .mockResolvedValueOnce({
          success: false,
          payload: { code: 700, error: 'BLE scan error' },
        })
        .mockResolvedValueOnce({ success: true, payload: [device] });

      const res = await searchDevices({ retryDelayMs: 0 });

      expect(res.success).toBe(true);
      expect(mockKeyring.bridge.searchDevices).toHaveBeenCalledTimes(2);
    });

    it.each([701, 702, 712, 721, 722])(
      'does not keep scanning on Bluetooth setup error %i',
      async code => {
        const { searchDevices, mockKeyring } = setupApiOneKeyModule();
        mockKeyring.bridge.searchDevices.mockResolvedValue({
          success: false,
          payload: { code, error: 'setup' },
        });

        const res = await searchDevices({ retryDelayMs: 0 });

        expect(res).toEqual({
          success: false,
          payload: { code, error: 'setup' },
        });
        expect(mockKeyring.bridge.searchDevices).toHaveBeenCalledTimes(1);
      },
    );

    it('stops scanning once the caller no longer wants results', async () => {
      const { searchDevices, mockKeyring } = setupApiOneKeyModule();
      let stopped = false;
      mockKeyring.bridge.searchDevices.mockImplementation(async () => {
        stopped = true;
        return { success: true, payload: [] };
      });

      await searchDevices({ retryDelayMs: 0, shouldStop: () => stopped });

      expect(mockKeyring.bridge.searchDevices).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel', () => {
    it('cancels the active connectId', async () => {
      const { cancel, mockKeyring } = setupApiOneKeyModule();
      mockKeyring.connectId = 'active';
      mockKeyring._deviceConnectId = 'selected';

      await cancel();

      expect(mockKeyring.bridge.cancel).toHaveBeenCalledWith('active');
    });

    it('falls back to the selected device before unlock', async () => {
      const { cancel, mockKeyring } = setupApiOneKeyModule();
      mockKeyring._deviceConnectId = 'selected';

      await cancel();

      expect(mockKeyring.bridge.cancel).toHaveBeenCalledWith('selected');
    });

    it('is a no-op without a device and never throws', async () => {
      const { cancel, mockKeyring } = setupApiOneKeyModule();
      await cancel();
      expect(mockKeyring.bridge.cancel).not.toHaveBeenCalled();

      mockKeyring.connectId = 'active';
      mockKeyring.bridge.cancel.mockImplementation(() => {
        throw new Error('boom');
      });
      await expect(cancel()).resolves.toBeUndefined();
    });
  });

  describe('device subscriptions', () => {
    function getSdkHandlers() {
      const sdk = require('@onekeyfe/hd-ble-sdk').default;
      const handler = (event: string) =>
        sdk.on.mock.calls.filter(([name]: [string]) => name === event);
      return { sdk, handler };
    }
    const flush = () => new Promise(resolve => setImmediate(resolve));

    it('subscribes to SDK device events only once', () => {
      const { startSubscribeOnekeyDevices } = setupApiOneKeyModule();
      startSubscribeOnekeyDevices();
      startSubscribeOnekeyDevices();
      const { handler } = getSdkHandlers();
      expect(handler('CONNECT')).toHaveLength(1);
      expect(handler('DISCONNECT')).toHaveLength(1);
    });

    it('cleans up the keyring when its own device disconnects', async () => {
      const { startSubscribeOnekeyDevices, mockKeyring } =
        setupApiOneKeyModule();
      mockKeyring.connectId = 'current-device';
      startSubscribeOnekeyDevices();
      const disconnect = getSdkHandlers().handler('DISCONNECT')[0][1];

      disconnect({ device: { connectId: 'current-device' } });
      await flush();

      expect(mockKeyring.cleanUp).toHaveBeenCalledTimes(1);
    });

    it('matches the device by path or the selected connect id', async () => {
      const { startSubscribeOnekeyDevices, mockKeyring } =
        setupApiOneKeyModule();
      mockKeyring._deviceConnectId = 'selected-device';
      startSubscribeOnekeyDevices();
      const disconnect = getSdkHandlers().handler('DISCONNECT')[0][1];

      disconnect({ device: { connectId: null, path: 'selected-device' } });
      await flush();

      expect(mockKeyring.cleanUp).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['another device', { device: { connectId: 'other-device' } }],
      ['an event without a device', {}],
      ['an event without ids', { device: {} }],
    ])('keeps the keyring state on %s', async (_name, payload) => {
      const { startSubscribeOnekeyDevices, mockKeyring } =
        setupApiOneKeyModule();
      mockKeyring.connectId = 'current-device';
      startSubscribeOnekeyDevices();
      const disconnect = getSdkHandlers().handler('DISCONNECT')[0][1];

      disconnect(payload);
      await flush();

      expect(mockKeyring.cleanUp).not.toHaveBeenCalled();
    });

    it('does not clean up when the keyring has no device yet', () => {
      const { isCurrentOneKeyDevice } = setupApiOneKeyModule();
      expect(
        isCurrentOneKeyDevice(
          { connectId: 'any' },
          { connectId: null, _deviceConnectId: undefined },
        ),
      ).toBe(false);
    });
  });
});
