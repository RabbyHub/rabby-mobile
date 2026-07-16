jest.mock(
  'p-queue/dist',
  () => ({
    __esModule: true,
    default: class MockPQueue {
      clear = jest.fn();

      add = jest.fn((fn: () => unknown) => fn());
    },
  }),
  { virtual: true },
);

function setupLedgerApiModule(appName: string) {
  jest.resetModules();
  jest.useFakeTimers();

  const mockKeyring = {
    makeApp: jest.fn(async () => undefined),
    getAddresses: jest.fn(async () => []),
    getAppAndVersion: jest.fn(async () => ({
      appName,
      version: '1.0.0',
    })),
    getDeviceId: jest.fn(() => 'ledger-device-id'),
    getAccountInfo: jest.fn(),
    setDeviceId: jest.fn(),
    setHDPathType: jest.fn(async () => undefined),
    setAccountToUnlock: jest.fn(async () => undefined),
  };
  const mockGetKeyring = jest.fn(async () => mockKeyring);
  const mockBindLedgerEvents = jest.fn();
  const mockUpdateFirmwareAlert = jest.fn();
  const mockGetLedgerAppAndVersion = jest.fn(async () => ({
    appName,
    version: '1.0.0',
  }));
  const mockResetLedgerDeviceSession = jest.fn(async () => true);
  const mockAddNewAccount = jest.fn();
  const mockInitCurrentAccount = jest.fn();

  jest.doMock('@rabby-wallet/keyring-utils', () => ({
    KEYRING_TYPE: {
      LedgerKeyring: 'Ledger Hardware',
    },
  }));
  jest.doMock('./keyring', () => ({
    getKeyring: mockGetKeyring,
  }));
  jest.doMock('@/utils/ledger', () => ({
    bindLedgerEvents: mockBindLedgerEvents,
  }));
  jest.doMock('../services/shared', () => ({
    keyringService: {
      addNewAccount: mockAddNewAccount,
      persistKeyringsForKeyring: jest.fn(),
    },
  }));
  jest.doMock('@/core/services', () => ({
    preferenceService: {
      initCurrentAccount: mockInitCurrentAccount,
    },
  }));
  jest.doMock('@/hooks/ledger/error', () => ({
    LEDGER_ERROR_CODES: {
      FIRMWARE_OR_APP_UPDATE_REQUIRED: 'firmware_or_app_update_required',
      UNKNOWN: 'unknown',
    },
    isLedgerBusyError: jest.fn((error: Error) =>
      error.message.includes('SendApduConcurrencyError'),
    ),
    isLedgerUserRejectedError: jest.fn((error: Error) =>
      /(?:0x5501|0x6985|RefusedByUserDAError)/u.test(error.message),
    ),
    ledgerErrorHandler: jest.fn(() => 'unknown'),
  }));
  jest.doMock('@/utils/bluetoothPermissions', () => ({
    UpdateFirmwareAlert: mockUpdateFirmwareAlert,
  }));
  jest.doMock('@/core/keyring-bridge/ledger/ledger-dmk', () => ({
    connectLedgerDevice: jest.fn(),
    disconnectLedgerDevice: jest.fn(),
    getLedgerAppAndVersion: mockGetLedgerAppAndVersion,
    resetLedgerDeviceSession: mockResetLedgerDeviceSession,
    subscribeLedgerDevices: jest.fn(),
  }));

  const apiLedger = require('./ledger') as typeof import('./ledger');

  return {
    ...apiLedger,
    mockKeyring,
    mockGetKeyring,
    mockGetLedgerAppAndVersion,
    mockResetLedgerDeviceSession,
    mockAddNewAccount,
    mockInitCurrentAccount,
  };
}

describe('core/apis/ledger', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.dontMock('@rabby-wallet/keyring-utils');
    jest.dontMock('./keyring');
    jest.dontMock('@/utils/ledger');
    jest.dontMock('../services/shared');
    jest.dontMock('@/core/services');
    jest.dontMock('@/hooks/ledger/error');
    jest.dontMock('@/utils/bluetoothPermissions');
    jest.dontMock('@/core/keyring-bridge/ledger/ledger-dmk');
  });

  it('reports Ethereum app as ready', async () => {
    const { checkEthApp, mockKeyring, mockGetLedgerAppAndVersion } =
      setupLedgerApiModule('Ethereum');
    const callback = jest.fn();

    await expect(checkEthApp(callback)).resolves.toBe(true);

    expect(mockGetLedgerAppAndVersion).toHaveBeenCalledWith('ledger-device-id');
    expect(mockKeyring.makeApp).not.toHaveBeenCalled();
    expect(mockKeyring.getAppAndVersion).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('reports a non-Ethereum Ledger app as not ready', async () => {
    const { checkEthApp, mockKeyring, mockGetLedgerAppAndVersion } =
      setupLedgerApiModule('BOLOS');
    const callback = jest.fn();

    await expect(checkEthApp(callback)).resolves.toBe(false);

    expect(mockGetLedgerAppAndVersion).toHaveBeenCalledWith('ledger-device-id');
    expect(mockKeyring.makeApp).not.toHaveBeenCalled();
    expect(mockKeyring.getAppAndVersion).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('falls back to the keyring app check when no Ledger device id is set', async () => {
    const { checkEthApp, mockKeyring, mockGetLedgerAppAndVersion } =
      setupLedgerApiModule('Ethereum');
    const callback = jest.fn();
    mockKeyring.getDeviceId.mockReturnValueOnce(undefined);

    await expect(checkEthApp(callback)).resolves.toBe(true);

    expect(mockGetLedgerAppAndVersion).not.toHaveBeenCalled();
    expect(mockKeyring.makeApp).toHaveBeenCalledTimes(1);
    expect(mockKeyring.getAppAndVersion).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('marks the Ledger session stale when address derivation disconnects', async () => {
    const { getAddresses, mockKeyring, mockResetLedgerDeviceSession } =
      setupLedgerApiModule('Ethereum');
    const error = new Error('DeviceDisconnectedWhileSendingError');

    jest.runOnlyPendingTimers();
    mockKeyring.getAddresses.mockRejectedValueOnce(error);

    await expect(getAddresses(0, 1)).rejects.toThrow(
      'DeviceDisconnectedWhileSendingError',
    );
    expect(mockResetLedgerDeviceSession).toHaveBeenCalledWith(
      'ledger-device-id',
    );
  });

  it('reports connected only after a live Ledger app probe succeeds', async () => {
    const { isConnected, mockKeyring, mockGetLedgerAppAndVersion } =
      setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([true, 'ledger-device-id']);

    expect(mockKeyring.setDeviceId).toHaveBeenCalledWith('ledger-device-id');
    expect(mockGetLedgerAppAndVersion).toHaveBeenCalledWith(
      'ledger-device-id',
      2000,
    );
  });

  it('resets a cached Ledger session when the live probe reports it locked', async () => {
    const {
      isConnected,
      mockKeyring,
      mockGetLedgerAppAndVersion,
      mockResetLedgerDeviceSession,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockGetLedgerAppAndVersion.mockRejectedValueOnce(new Error('0x5515'));

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([false, 'ledger-device-id']);

    expect(mockResetLedgerDeviceSession).toHaveBeenCalledWith(
      'ledger-device-id',
    );
  });

  it('keeps an active Ledger session when a live probe reports APDU concurrency', async () => {
    const {
      isConnected,
      mockKeyring,
      mockGetLedgerAppAndVersion,
      mockResetLedgerDeviceSession,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockGetLedgerAppAndVersion.mockRejectedValueOnce(
      new Error('SendApduConcurrencyError'),
    );

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([true, 'ledger-device-id']);

    expect(mockResetLedgerDeviceSession).not.toHaveBeenCalled();
  });

  it('checks the persisted Ledger device id with a live app probe', async () => {
    const { isConnected, mockKeyring, mockGetLedgerAppAndVersion } =
      setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([true, 'ledger-device-id']);

    expect(mockGetLedgerAppAndVersion).toHaveBeenCalledWith(
      'ledger-device-id',
      2000,
    );
  });

  it('resets the session when the persisted Ledger device is unreachable', async () => {
    const {
      isConnected,
      mockKeyring,
      mockGetLedgerAppAndVersion,
      mockResetLedgerDeviceSession,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockGetLedgerAppAndVersion.mockRejectedValueOnce(
      new Error('OpeningConnectionError'),
    );

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([false, 'ledger-device-id']);

    expect(mockResetLedgerDeviceSession).toHaveBeenCalledWith(
      'ledger-device-id',
    );
  });

  it('reports a stale session before its BLE teardown finishes', async () => {
    const {
      isConnected,
      mockKeyring,
      mockGetLedgerAppAndVersion,
      mockResetLedgerDeviceSession,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockGetLedgerAppAndVersion.mockRejectedValueOnce(
      new Error('OpeningConnectionError'),
    );

    let finishReset = () => undefined;
    mockResetLedgerDeviceSession.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishReset = resolve;
        }),
    );

    let result: unknown;
    const checking = isConnected(
      '0x0000000000000000000000000000000000000001',
    ).then(value => {
      result = value;
    });

    try {
      for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
      }
      expect(result).toEqual([false, 'ledger-device-id']);
    } finally {
      finishReset();
      await checking;
    }
  });

  it('bounds the entire connection check before a BLE connect settles', async () => {
    const {
      isConnected,
      mockKeyring,
      mockGetLedgerAppAndVersion,
      mockResetLedgerDeviceSession,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });

    let finishProbe: (value: {
      appName: string;
      version: string;
    }) => void = () => undefined;
    mockGetLedgerAppAndVersion.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishProbe = resolve;
        }),
    );

    let result: unknown;
    const checking = isConnected(
      '0x0000000000000000000000000000000000000001',
    ).then(value => {
      result = value;
    });

    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }
    jest.advanceTimersByTime(2000);

    try {
      for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
      }
      expect(result).toEqual([false, 'ledger-device-id']);
      expect(mockResetLedgerDeviceSession).toHaveBeenCalledWith(
        'ledger-device-id',
      );
    } finally {
      finishProbe({ appName: 'Ethereum', version: '1.0.0' });
      await checking;
    }
  });

  it('does not retry account import after the user rejects opening the app', async () => {
    const { importFirstAddress, mockAddNewAccount, mockInitCurrentAccount } =
      setupLedgerApiModule('Ethereum');
    mockAddNewAccount.mockRejectedValueOnce(
      new Error('RefusedByUserDAError 0x5501'),
    );

    await expect(importFirstAddress({ retryCount: 5 })).rejects.toThrow(
      'RefusedByUserDAError 0x5501',
    );

    expect(mockAddNewAccount).toHaveBeenCalledTimes(1);
    expect(mockInitCurrentAccount).not.toHaveBeenCalled();
  });
});
