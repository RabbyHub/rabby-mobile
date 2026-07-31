import { act, renderHook } from '@testing-library/react-native';

import { perpsServiceApi } from '@/core/serviceApi/perps';

import type { PerpsTickOption } from '../model/orderBook';
import { usePerpsBookPrecision } from './usePerpsBookPrecision';

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getPerpsBookPrecision: jest.fn(),
    setPerpsBookPrecision: jest.fn(),
  },
}));

const mockGetPrecision =
  perpsServiceApi.getPerpsBookPrecision as jest.MockedFunction<
    typeof perpsServiceApi.getPerpsBookPrecision
  >;
const mockSetPrecision =
  perpsServiceApi.setPerpsBookPrecision as jest.MockedFunction<
    typeof perpsServiceApi.setPerpsBookPrecision
  >;

const tickOptions: PerpsTickOption[] = [
  {
    displayPrice: 0.1,
    mantissa: null,
    nSigFigs: 5,
    priceDecimals: 1,
  },
  {
    displayPrice: 0.2,
    mantissa: 2,
    nSigFigs: 5,
    priceDecimals: 1,
  },
  {
    displayPrice: 1,
    mantissa: null,
    nSigFigs: 4,
    priceDecimals: 0,
  },
];

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('usePerpsBookPrecision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPrecision.mockResolvedValue({
      mantissa: null,
      nSigFigs: 5,
    });
    mockSetPrecision.mockResolvedValue(undefined);
  });

  it('serializes rapid writes and rolls the latest failure back to the last persisted value', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSetPrecision
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);

    const hook = renderHook(() =>
      usePerpsBookPrecision({
        marketKey: 'native:BTC',
        tickOptions,
      }),
    );
    await flushPromises();

    expect(hook.result.current.selectedTickOption).toBe(tickOptions[0]);

    act(() => {
      hook.result.current.selectTickOption(tickOptions[1]!);
      hook.result.current.selectTickOption(tickOptions[2]!);
    });
    await flushPromises();

    expect(hook.result.current.selectedTickOption).toBe(tickOptions[2]);
    expect(mockSetPrecision).toHaveBeenCalledTimes(1);

    firstWrite.resolve();
    await flushPromises();

    expect(mockSetPrecision).toHaveBeenCalledTimes(2);
    expect(hook.result.current.selectedTickOption).toBe(tickOptions[2]);

    secondWrite.reject(new Error('write failed'));
    await flushPromises();

    expect(hook.result.current.selectedTickOption).toBe(tickOptions[1]);
    expect(hook.result.current.precision).toEqual({
      mantissa: 2,
      nSigFigs: 5,
    });
    consoleError.mockRestore();
  });

  it('ignores a pending write failure after the market changes', async () => {
    const pendingWrite = deferred<void>();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetPrecision
      .mockResolvedValueOnce({
        mantissa: null,
        nSigFigs: 5,
      })
      .mockResolvedValueOnce({
        mantissa: null,
        nSigFigs: 4,
      });
    mockSetPrecision.mockReturnValueOnce(pendingWrite.promise);

    const hook = renderHook(
      ({ marketKey }: { marketKey: string }) =>
        usePerpsBookPrecision({
          marketKey,
          tickOptions,
        }),
      { initialProps: { marketKey: 'native:BTC' } },
    );
    await flushPromises();

    act(() => {
      hook.result.current.selectTickOption(tickOptions[1]!);
    });
    await flushPromises();

    hook.rerender({ marketKey: 'native:ETH' });
    await flushPromises();
    expect(hook.result.current.selectedTickOption).toBe(tickOptions[2]);

    pendingWrite.reject(new Error('old market write failed'));
    await flushPromises();

    expect(hook.result.current.selectedTickOption).toBe(tickOptions[2]);
    consoleError.mockRestore();
  });
});
