import { act, renderHook } from '@testing-library/react-native';

const mockSearchDevices = jest.fn();
const mockRequestPermissions = jest.fn();
let mockDevices: any[] = [];
const mockSetDevices = jest.fn((next: any[]) => {
  mockDevices = next;
});

jest.mock('@/core/apis', () => ({
  apiOneKey: {
    searchDevices: (...args: any[]) => mockSearchDevices(...args),
  },
}));
jest.mock('@/core/apis/onekey', () => ({
  useOneKeyDevices: () => ({
    devices: mockDevices,
    setOneKeyDevices: mockSetDevices,
  }),
}));
jest.mock('@/utils/bluetoothPermissions', () => ({
  requestAndroidBleScanPermissions: () => mockRequestPermissions(),
}));

import { useOneKeyImport } from './useOneKeyImport';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useOneKeyImport', () => {
  beforeEach(() => {
    mockDevices = [{ connectId: 'stale', name: 'old' }];
    mockSetDevices.mockClear();
    mockSearchDevices.mockReset();
    mockRequestPermissions.mockReset();
    mockRequestPermissions.mockResolvedValue(true);
  });

  it('clears stale devices and reports found devices', async () => {
    const device = { connectId: 'ble-1', name: 'Pro 2' };
    mockSearchDevices.mockResolvedValue({ success: true, payload: [device] });
    const { result } = renderHook(() => useOneKeyImport());

    await act(async () => {
      await result.current.startScan();
    });

    expect(mockSetDevices).toHaveBeenNthCalledWith(1, []);
    expect(mockSetDevices).toHaveBeenLastCalledWith([device]);
    expect(result.current.status).toBe('found');
    expect(result.current.error).toBeUndefined();
  });

  it('reports notFound for an empty scan instead of spinning forever', async () => {
    mockSearchDevices.mockResolvedValue({ success: true, payload: [] });
    const { result } = renderHook(() => useOneKeyImport());

    await act(async () => {
      await result.current.startScan();
    });

    expect(result.current.status).toBe('notFound');
  });

  it('keeps the SDK error code', async () => {
    mockSearchDevices.mockResolvedValue({
      success: false,
      payload: { code: 721, error: 'Bluetooth is turned off' },
    });
    const { result } = renderHook(() => useOneKeyImport());

    await act(async () => {
      await result.current.startScan();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(721);
  });

  it('does not scan without Bluetooth permission', async () => {
    mockRequestPermissions.mockResolvedValue(false);
    const { result } = renderHook(() => useOneKeyImport());

    await act(async () => {
      await result.current.startScan();
    });

    expect(mockSearchDevices).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(702);
  });

  it('ignores a scan that finishes after the sheet unmounted', async () => {
    const scan = deferred<any>();
    mockSearchDevices.mockReturnValue(scan.promise);
    const { result, unmount } = renderHook(() => useOneKeyImport());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.startScan();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const { shouldStop } = mockSearchDevices.mock.calls[0][0];
    expect(shouldStop()).toBe(false);

    unmount();
    expect(shouldStop()).toBe(true);
    scan.resolve({ success: true, payload: [{ connectId: 'late' }] });
    await pending;

    expect(mockSetDevices).not.toHaveBeenCalledWith([{ connectId: 'late' }]);
  });

  it('lets a newer scan win over an older one', async () => {
    const first = deferred<any>();
    mockSearchDevices
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ success: true, payload: [] });
    const { result } = renderHook(() => useOneKeyImport());

    let firstScan!: Promise<void>;
    act(() => {
      firstScan = result.current.startScan();
    });
    // Let the first scan get past the permission check into searchDevices.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSearchDevices).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.startScan();
    });
    await act(async () => {
      first.resolve({ success: true, payload: [{ connectId: 'old-scan' }] });
      await firstScan;
    });

    expect(result.current.status).toBe('notFound');
    expect(mockSetDevices).not.toHaveBeenCalledWith([
      { connectId: 'old-scan' },
    ]);
  });
});
