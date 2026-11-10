import { act, renderHook } from '@testing-library/react-native';
import { resolveEnsAddressByName, resolveEnsNameByAddress } from '@/utils/ens';
import { useEnsInputResolver } from './useEnsInputResolver';

jest.mock('@/utils/ens', () => ({
  resolveEnsAddressByName: jest.fn(),
  resolveEnsNameByAddress: jest.fn(),
}));

const mockResolveName = resolveEnsAddressByName as jest.MockedFunction<
  typeof resolveEnsAddressByName
>;
const mockResolveAddress = resolveEnsNameByAddress as jest.MockedFunction<
  typeof resolveEnsNameByAddress
>;

const ADDR_A = '0x1111111111111111111111111111111111111111';
const ADDR_B = '0x2222222222222222222222222222222222222222';

const parseAddress = (input: string) =>
  /^0x[0-9a-fA-F]{40}$/.test(input) ? input : null;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
};

/** Queues one pending lookup per call; tests settle them in any order. */
const queueLookups = <T>(mock: jest.Mock) => {
  const pending = new Map<string, Deferred<T>>();
  mock.mockImplementation((value: string) => {
    const d = deferred<T>();
    pending.set(value, d);
    return d.promise;
  });
  return pending;
};

const renderResolver = (initialInput = '') =>
  renderHook(
    ({ input }: { input: string }) =>
      useEnsInputResolver(input, { parseAddress, debounceMs: 500 }),
    { initialProps: { input: initialInput } },
  );

const flushDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
};

const settle = async <T>(d: Deferred<T> | undefined, value: T) => {
  await act(async () => {
    d!.resolve(value);
  });
};

describe('useEnsInputResolver', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockResolveName.mockReset();
    mockResolveAddress.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces typing into one lookup and reports the result', async () => {
    const pending = queueLookups(mockResolveName);
    const { result, rerender } = renderResolver();

    rerender({ input: 'jan' });
    rerender({ input: 'jan.eth' });
    expect(result.current.isResolvingName).toBe(true);
    await flushDebounce();

    expect(mockResolveName).toHaveBeenCalledTimes(1);
    expect(mockResolveName).toHaveBeenCalledWith('jan.eth');
    expect(result.current.isResolvingName).toBe(true);

    await settle(pending.get('jan.eth'), { addr: ADDR_A, name: 'jan.eth' });

    expect(result.current).toEqual({
      ensResult: { addr: ADDR_A, name: 'jan.eth' },
      isResolvingName: false,
      isNameNotFound: false,
    });
  });

  it('reports not found only when the lookup of the current input fails', async () => {
    const pending = queueLookups(mockResolveName);
    const { result } = renderResolver('nobody.eth');
    await flushDebounce();

    await settle(pending.get('nobody.eth'), null);

    expect(result.current).toEqual({
      ensResult: null,
      isResolvingName: false,
      isNameNotFound: true,
    });
  });

  it('drops a late failure of a partial name typed during a pause', async () => {
    const pending = queueLookups(mockResolveName);
    const { result, rerender } = renderResolver('janbenes.zk.mone');
    await flushDebounce();

    rerender({ input: 'janbenes.zk.money' });
    await settle(pending.get('janbenes.zk.mone'), null);

    expect(result.current.isNameNotFound).toBe(false);
    expect(result.current.isResolvingName).toBe(true);

    await flushDebounce();
    await settle(pending.get('janbenes.zk.money'), {
      addr: ADDR_A,
      name: 'janbenes.zk.money',
    });

    expect(result.current.ensResult).toEqual({
      addr: ADDR_A,
      name: 'janbenes.zk.money',
    });
    expect(result.current.isNameNotFound).toBe(false);
  });

  it('never shows the address of a name that is no longer in the input', async () => {
    const pending = queueLookups(mockResolveName);
    const { result, rerender } = renderResolver('janbenes.zk.money');
    await flushDebounce();

    rerender({ input: 'janbenes.zk.mone' });
    await settle(pending.get('janbenes.zk.money'), {
      addr: ADDR_A,
      name: 'janbenes.zk.money',
    });

    expect(result.current.ensResult).toBeNull();
    expect(result.current.isResolvingName).toBe(true);
  });

  it('keeps the newer result when an older lookup of another name settles last', async () => {
    const pending = queueLookups(mockResolveName);
    const { result, rerender } = renderResolver('alice.eth');
    await flushDebounce();
    rerender({ input: 'bob.eth' });
    await flushDebounce();

    await settle(pending.get('bob.eth'), { addr: ADDR_B, name: 'bob.eth' });
    await settle(pending.get('alice.eth'), { addr: ADDR_A, name: 'alice.eth' });

    expect(result.current.ensResult).toEqual({
      addr: ADDR_B,
      name: 'bob.eth',
    });
  });

  it('accepts a lookup that started earlier for the same input', async () => {
    const pending = queueLookups(mockResolveName);
    const { result, rerender } = renderResolver('jan.eth');
    await flushDebounce();
    const first = pending.get('jan.eth');

    rerender({ input: 'jan.et' });
    rerender({ input: 'jan.eth' });
    await settle(first, { addr: ADDR_A, name: 'jan.eth' });

    expect(result.current.ensResult).toEqual({
      addr: ADDR_A,
      name: 'jan.eth',
    });
  });

  it('drops a late reverse lookup once the input is no longer that address', async () => {
    const pending = queueLookups(mockResolveAddress);
    const { result, rerender } = renderResolver(ADDR_A);
    await flushDebounce();
    expect(mockResolveAddress).toHaveBeenCalledWith(ADDR_A);
    expect(result.current.isResolvingName).toBe(false);

    rerender({ input: 'bob.eth' });
    await settle(pending.get(ADDR_A), 'alice.eth');

    expect(result.current.ensResult).toBeNull();
    expect(result.current.isResolvingName).toBe(true);
  });

  it('reports the name of the current address', async () => {
    const pending = queueLookups(mockResolveAddress);
    const { result } = renderResolver(ADDR_A);
    await flushDebounce();

    await settle(pending.get(ADDR_A), 'alice.eth');

    expect(result.current).toEqual({
      ensResult: { addr: ADDR_A, name: 'alice.eth' },
      isResolvingName: false,
      isNameNotFound: false,
    });
  });

  it('does not look anything up for an empty input', async () => {
    const { result, rerender } = renderResolver('jan.eth');
    rerender({ input: '' });
    await flushDebounce();

    expect(mockResolveName).not.toHaveBeenCalled();
    expect(mockResolveAddress).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      ensResult: null,
      isResolvingName: false,
      isNameNotFound: false,
    });
  });
});
