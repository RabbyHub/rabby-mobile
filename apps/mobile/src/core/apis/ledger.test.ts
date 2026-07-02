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
    getAppAndVersion: jest.fn(async () => ({
      appName,
      version: '1.0.0',
    })),
    getAccountInfo: jest.fn(),
    setDeviceId: jest.fn(),
  };
  const mockGetKeyring = jest.fn(async () => mockKeyring);
  const mockBindLedgerEvents = jest.fn();
  const mockUpdateFirmwareAlert = jest.fn();
  const mockConnectLedgerDeviceById = jest.fn();
  const mockIsLedgerDeviceConnected = jest.fn();
  const mockIsLedgerDeviceReachable = jest.fn();

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
    connectLedgerDeviceById: mockConnectLedgerDeviceById,
    disconnectLedgerDevice: jest.fn(),
    isLedgerDeviceConnected: mockIsLedgerDeviceConnected,
    isLedgerDeviceReachable: mockIsLedgerDeviceReachable,
    subscribeLedgerDevices: jest.fn(),
  }));

  const apiLedger = require('./ledger') as typeof import('./ledger');

  return {
    ...apiLedger,
    mockKeyring,
    mockGetKeyring,
    mockConnectLedgerDeviceById,
    mockIsLedgerDeviceConnected,
    mockIsLedgerDeviceReachable,
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
    const { checkEthApp, mockKeyring } = setupLedgerApiModule('Ethereum');
    const callback = jest.fn();

    await expect(checkEthApp(callback)).resolves.toBe(true);

    expect(mockKeyring.makeApp).toHaveBeenCalledTimes(1);
    expect(mockKeyring.getAppAndVersion).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('reports a non-Ethereum Ledger app as not ready', async () => {
    const { checkEthApp, mockKeyring } = setupLedgerApiModule('BOLOS');
    const callback = jest.fn();

    await expect(checkEthApp(callback)).resolves.toBe(false);

    expect(mockKeyring.makeApp).toHaveBeenCalledTimes(1);
    expect(mockKeyring.getAppAndVersion).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('reconnects a known Ledger device before asking the UI to pick one', async () => {
    const {
      isConnected,
      mockKeyring,
      mockConnectLedgerDeviceById,
      mockIsLedgerDeviceConnected,
      mockIsLedgerDeviceReachable,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockIsLedgerDeviceConnected
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    mockIsLedgerDeviceReachable.mockResolvedValueOnce(true);
    mockConnectLedgerDeviceById.mockResolvedValueOnce('session-1');

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([true, 'ledger-device-id']);

    expect(mockKeyring.setDeviceId).toHaveBeenCalledWith('ledger-device-id');
    expect(mockConnectLedgerDeviceById).toHaveBeenCalledWith(
      'ledger-device-id',
    );
  });

  it('returns disconnected when reconnecting a known Ledger device fails', async () => {
    const {
      isConnected,
      mockKeyring,
      mockConnectLedgerDeviceById,
      mockIsLedgerDeviceConnected,
    } = setupLedgerApiModule('Ethereum');
    mockKeyring.getAccountInfo.mockReturnValue({
      deviceId: 'ledger-device-id',
    });
    mockIsLedgerDeviceConnected.mockReturnValue(false);
    mockConnectLedgerDeviceById.mockRejectedValueOnce(
      new Error('Ledger: Device not found'),
    );

    await expect(
      isConnected('0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual([false, 'ledger-device-id']);

    expect(mockConnectLedgerDeviceById).toHaveBeenCalledWith(
      'ledger-device-id',
    );
  });
});
