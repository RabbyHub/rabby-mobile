import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockRead = jest.fn();
const mockSync = jest.fn();
jest.mock('@/core/apis/safe', () => ({
  apisSafe: {
    getGnosisNetworkIds: (...args: unknown[]) => mockRead(...args),
    syncGnosisNetworks: (...args: unknown[]) => mockSync(...args),
  },
}));

import { publishGnosisNetworks } from '@/core/utils/safeNetworkEvents';
import { useGnosisNetworks } from './useGnosisNetworks';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

// Hook unit tests: service I/O is mocked; ahooks and event delivery are real.
describe('useGnosisNetworks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRead.mockResolvedValue(['1']);
    mockSync.mockImplementation(() => new Promise(() => {}));
  });

  it('renders the local list before discovery and receives address-specific changes', async () => {
    const sync = deferred<string[]>();
    mockSync.mockReturnValue(sync.promise);
    const hook = renderHook(() => useGnosisNetworks({ address: '0xAbC' }));
    await waitFor(() => expect(hook.result.current.data).toEqual(['1']));
    expect(hook.result.current.syncing).toBe(true);
    expect(mockRead).toHaveBeenCalledWith('0xabc');
    act(() => publishGnosisNetworks('0xother', ['10']));
    expect(hook.result.current.data).toEqual(['1']);
    await act(async () => {
      publishGnosisNetworks('0xABC', ['137']);
      sync.resolve(['137']);
    });
    expect(hook.result.current.data).toEqual(['137']);
    expect(hook.result.current.syncing).toBe(false);
    hook.unmount();
  });

  it('ignores an old local read after a synchronization event', async () => {
    const read = deferred<string[]>();
    mockRead.mockReturnValue(read.promise);
    const hook = renderHook(() => useGnosisNetworks({ address: '0xabc' }));
    act(() => publishGnosisNetworks('0xabc', ['1', '10']));
    await act(async () => read.resolve(['1']));
    expect(hook.result.current.data).toEqual(['1', '10']);
    hook.unmount();
  });

  it('pauses hidden consumers and catches up on focus', async () => {
    const sync = deferred<string[]>();
    mockSync.mockReturnValue(sync.promise);
    const hook = renderHook(
      ({ active }) => useGnosisNetworks({ address: '0xabc', active }),
      { initialProps: { active: true } },
    );
    await waitFor(() => expect(hook.result.current.data).toEqual(['1']));
    hook.rerender({ active: false });
    await act(async () => {
      publishGnosisNetworks('0xabc', ['10']);
      sync.resolve(['10']);
    });
    expect(hook.result.current.data).toEqual(['1']);
    mockRead.mockResolvedValue(['10']);
    hook.rerender({ active: true });
    await waitFor(() => expect(hook.result.current.data).toEqual(['10']));
    expect(mockSync).toHaveBeenCalledTimes(2);
    hook.unmount();
  });

  it('never displays another address list while the next local read is pending', async () => {
    const hook = renderHook(({ address }) => useGnosisNetworks({ address }), {
      initialProps: { address: '0xabc' },
    });
    await waitFor(() => expect(hook.result.current.data).toEqual(['1']));
    const read = deferred<string[]>();
    mockRead.mockReturnValue(read.promise);
    hook.rerender({ address: '0xdef' });
    expect(hook.result.current.data).toBeUndefined();
    act(() => publishGnosisNetworks('0xabc', ['10']));
    expect(hook.result.current.data).toBeUndefined();
    await act(async () => read.resolve(['137']));
    expect(hook.result.current.data).toEqual(['137']);
    hook.unmount();
  });

  it('does not read or scan without an active address', () => {
    const hook = renderHook(() => useGnosisNetworks({ address: undefined }));
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
    hook.unmount();
  });
});
