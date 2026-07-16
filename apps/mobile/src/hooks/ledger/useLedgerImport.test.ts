import { act, renderHook } from '@testing-library/react-native';

const mockCleanUp = jest.fn();
const mockSearchDevices = jest.fn();
const mockCheckAndRequestAndroidBluetooth = jest.fn();
const mockShowBluetoothPermissionsAlert = jest.fn();
const mockShowBluetoothPoweredOffAlert = jest.fn();
const mockLedgerErrorHandler = jest.fn();

jest.mock('@/core/apis', () => ({
  apiLedger: {
    cleanUp: (...args: unknown[]) => mockCleanUp(...args),
    searchDevices: (...args: unknown[]) => mockSearchDevices(...args),
  },
}));

jest.mock('../../utils/bluetoothPermissions', () => ({
  checkAndRequestAndroidBluetooth: (...args: unknown[]) =>
    mockCheckAndRequestAndroidBluetooth(...args),
  showBluetoothPermissionsAlert: (...args: unknown[]) =>
    mockShowBluetoothPermissionsAlert(...args),
  showBluetoothPoweredOffAlert: (...args: unknown[]) =>
    mockShowBluetoothPoweredOffAlert(...args),
}));

jest.mock('./error', () => ({
  ledgerErrorHandler: (...args: unknown[]) => mockLedgerErrorHandler(...args),
  LEDGER_ERROR_CODES: {
    BLUETOOTH_PERMISSION_DENIED: 'bluetooth_permission_denied',
    BLUETOOTH_POWERED_OFF: 'bluetooth_powered_off',
  },
}));

const { useLedgerImport } =
  require('./useLedgerImport') as typeof import('./useLedgerImport');

describe('useLedgerImport', () => {
  let scanNext: ((device: { id: string; name: string }) => void) | undefined;
  let scanError: ((error: Error) => void | Promise<void>) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    scanNext = undefined;
    scanError = undefined;
    mockCleanUp.mockResolvedValue(undefined);
    mockSearchDevices.mockImplementation(({ next, error }) => {
      scanNext = next;
      scanError = error;
      return jest.fn();
    });
  });

  it('clears stale discoveries before retrying a scan', async () => {
    const device = { id: 'ledger-device-id', name: 'Ledger' };
    const { result } = renderHook(() => useLedgerImport());

    await act(async () => result.current.searchAndPair());
    act(() => scanNext?.(device));
    expect(result.current.devices).toEqual([device]);

    await act(async () => result.current.searchAndPair());

    expect(result.current.devices).toEqual([]);

    act(() => scanNext?.(device));
    expect(result.current.devices).toEqual([device]);
  });

  it('waits for the previous native scan to stop before retrying', async () => {
    let finishStopping = () => undefined;
    const stopSearch = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finishStopping = resolve;
        }),
    );
    mockSearchDevices.mockImplementationOnce(({ next, error }) => {
      scanNext = next;
      scanError = error;
      return stopSearch;
    });
    const { result } = renderHook(() => useLedgerImport());

    await act(async () => result.current.searchAndPair());

    let retry: Promise<void> | undefined;
    act(() => {
      retry = result.current.searchAndPair();
    });
    await act(async () => Promise.resolve());

    expect(stopSearch).toHaveBeenCalledTimes(1);
    expect(mockSearchDevices).toHaveBeenCalledTimes(1);

    finishStopping();
    await act(async () => retry);

    expect(mockSearchDevices).toHaveBeenCalledTimes(2);
  });

  it('restores the powered-off recovery alert', async () => {
    mockLedgerErrorHandler.mockReturnValueOnce('bluetooth_powered_off');
    const { result } = renderHook(() => useLedgerImport());

    await act(async () => result.current.searchAndPair());
    await act(async () => {
      await scanError?.(new Error('scan failed'));
    });

    expect(mockCleanUp).toHaveBeenCalledTimes(1);
    expect(mockShowBluetoothPoweredOffAlert).toHaveBeenCalledTimes(1);
    expect(mockLedgerErrorHandler).toHaveBeenCalledTimes(1);
    expect(result.current.errorCode).toBe('bluetooth_powered_off');
  });

  it('still shows the powered-off alert when cleanup fails', async () => {
    mockLedgerErrorHandler.mockReturnValueOnce('bluetooth_powered_off');
    mockCleanUp.mockRejectedValueOnce(new Error('cleanup failed'));
    const { result } = renderHook(() => useLedgerImport());

    await act(async () => result.current.searchAndPair());
    await act(async () => {
      await expect(
        scanError?.(new Error('scan failed')),
      ).resolves.toBeUndefined();
    });

    expect(mockShowBluetoothPoweredOffAlert).toHaveBeenCalledTimes(1);
  });

  it('restores the denied-permission recovery alert on iOS', async () => {
    mockLedgerErrorHandler.mockReturnValueOnce('bluetooth_permission_denied');
    const { result } = renderHook(() => useLedgerImport());

    await act(async () => result.current.searchAndPair());
    await act(async () => {
      await scanError?.(new Error('scan failed'));
    });

    expect(mockShowBluetoothPermissionsAlert).toHaveBeenCalledTimes(1);
    expect(mockLedgerErrorHandler).toHaveBeenCalledTimes(1);
    expect(result.current.errorCode).toBe('bluetooth_permission_denied');
  });
});
