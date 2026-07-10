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
  };
  const mockGetKeyring = jest.fn(async () => mockKeyring);
  const mockBindLedgerEvents = jest.fn();
  const mockUpdateFirmwareAlert = jest.fn();
  const mockConnectKnownLedgerDeviceById = jest.fn();
  const mockGetLedgerAppAndVersion = jest.fn(async () => ({
    appName,
    version: '1.0.0',
  }));
  const mockGetLedgerDeviceSessionState = jest.fn();
  const mockGetKnownLedgerDevice = jest.fn((deviceId: string) => ({
    id: deviceId,
    name: 'Ledger',
  }));
  const mockResetLedgerDeviceSession = jest.fn();

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
      addNewAccount: jest.fn(),
      persistKeyringsForKeyring: jest.fn(),
    },
    preferenceService: {
      initCurrentAccount: jest.fn(),
    },
  }));
  jest.doMock('@/hooks/ledger/error', () => ({
    LEDGER_ERROR_CODES: {
      FIRMWARE_OR_APP_UPDATE_REQUIRED: 'firmware_or_app_update_required',
      UNKNOWN: 'unknown',
    },
    ledgerErrorHandler: jest.fn(() => 'unknown'),
  }));
  jest.doMock('@/utils/bluetoothPermissions', () => ({
    UpdateFirmwareAlert: mockUpdateFirmwareAlert,
  }));
  jest.doMock('@/core/keyring-bridge/ledger/ledger-dmk', () => ({
    connectLedgerDevice: jest.fn(),
    connectKnownLedgerDeviceById: mockConnectKnownLedgerDeviceById,
    disconnectLedgerDevice: jest.fn(),
    getLedgerAppAndVersion: mockGetLedgerAppAndVersion,
    getLedgerDeviceSessionState: mockGetLedgerDeviceSessionState,
    getKnownLedgerDevice: mockGetKnownLedgerDevice,
    resetLedgerDeviceSession: mockResetLedgerDeviceSession,
    subscribeLedgerDevices: jest.fn(),
  }));

  const apiLedger = require('./ledger') as typeof import('./ledger');

  return {
    ...apiLedger,
    mockKeyring,
    mockGetKeyring,
    mockConnectKnownLedgerDeviceById,
    mockGetLedgerAppAndVersion,
    mockGetLedgerDeviceSessionState,
    mockGetKnownLedgerDevice,
    mockResetLedgerDeviceSession,
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

  it('reports connected when a current Ledger session exists', async () => {
    const { isConnected, mockKeyring, mockGetLedgerDeviceSessionState } =
      setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockGetLedgerDeviceSessionState.mockResolvedValueOnce({
      deviceStatus: 'CONNECTED',
    });

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([true, 'ledger-device-id']);

    expect(mockKeyring.setDeviceId).toHaveBeenCalledWith('ledger-device-id');
    expect(mockGetLedgerDeviceSessionState).toHaveBeenCalledWith(
      'ledger-device-id',
    );
  });

  it('reports disconnected when the current Ledger session is locked', async () => {
    const {
      isConnected,
      mockKeyring,
      mockConnectKnownLedgerDeviceById,
      mockGetLedgerDeviceSessionState,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockGetLedgerDeviceSessionState
      .mockResolvedValueOnce({
        deviceStatus: 'LOCKED',
      })
      .mockResolvedValueOnce({
        deviceStatus: 'LOCKED',
      });
    mockConnectKnownLedgerDeviceById.mockResolvedValueOnce('session-1');

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([false, 'ledger-device-id']);
  });

  it('checks the persisted Ledger device id when no live session exists', async () => {
    const {
      isConnected,
      mockKeyring,
      mockConnectKnownLedgerDeviceById,
      mockGetLedgerDeviceSessionState,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockGetLedgerDeviceSessionState.mockResolvedValueOnce(undefined);
    mockGetLedgerDeviceSessionState.mockResolvedValueOnce({
      deviceStatus: 'CONNECTED',
    });
    mockConnectKnownLedgerDeviceById.mockResolvedValueOnce('session-1');

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([true, 'ledger-device-id']);

    expect(mockConnectKnownLedgerDeviceById).toHaveBeenCalledWith(
      'ledger-device-id',
    );
  });

  it('reports disconnected when the persisted Ledger device id cannot connect', async () => {
    const {
      isConnected,
      mockKeyring,
      mockConnectKnownLedgerDeviceById,
      mockGetLedgerDeviceSessionState,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockGetLedgerDeviceSessionState.mockResolvedValueOnce(undefined);
    mockConnectKnownLedgerDeviceById.mockRejectedValueOnce(
      new Error('OpeningConnectionError'),
    );

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([false, 'ledger-device-id']);
  });
});
