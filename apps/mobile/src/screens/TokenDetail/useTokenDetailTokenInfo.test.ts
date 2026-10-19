import { act, renderHook } from '@testing-library/react-native';
import type { ITokenItem } from '@/store/tokens';
import {
  getTokenDetailBalanceStatus,
  getTokenDetailRequestKey,
  useTokenDetailTokenInfo,
} from './useTokenDetailTokenInfo';

// Unit tests: use the real ahooks request lifecycle; only its API boundary is
// replaced. These prove scoped readiness, not the native loading animation.
const token = { id: 'eth', chain: 'eth', amount: 0 } as ITokenItem;
const requestKey = (address = 'owner-a', tokenId = 'eth') =>
  getTokenDetailRequestKey({
    address,
    chain: 'eth',
    tokenId,
    isCustomTestnetToken: false,
  });

it('normalizes the address but keeps token and chain identity in the key', () => {
  expect(requestKey('OWNER-A')).toBe(requestKey('owner-a'));
  expect(requestKey('owner-a', 'other-token')).not.toBe(requestKey());
  expect(
    getTokenDetailRequestKey({
      address: 'owner-a',
      chain: 'arb',
      tokenId: 'eth',
      isCustomTestnetToken: false,
    }),
  ).not.toBe(requestKey());
});

it.each([
  {
    label: 'asset-list cached balance is ready immediately',
    input: {
      needUseCacheToken: true,
      hasTokenInfo: false,
      initialLoading: true,
      routeTokenAmount: 12.5,
    },
    expected: 'ready',
  },
  {
    label: 'history placeholder amount still shows loading',
    input: {
      needUseCacheToken: true,
      hasTokenInfo: false,
      initialLoading: true,
      routeTokenAmount: 0,
    },
    expected: 'loading',
  },
  {
    label: 'failed placeholder becomes unavailable',
    input: {
      needUseCacheToken: true,
      hasTokenInfo: false,
      initialLoading: false,
      routeTokenAmount: 0,
    },
    expected: 'unavailable',
  },
  {
    label: 'authoritative token info is ready',
    input: {
      needUseCacheToken: true,
      hasTokenInfo: true,
      initialLoading: true,
      routeTokenAmount: 0,
    },
    expected: 'ready',
  },
  {
    label: 'non-cache entry is ready',
    input: {
      needUseCacheToken: false,
      hasTokenInfo: false,
      initialLoading: true,
      routeTokenAmount: 0,
    },
    expected: 'ready',
  },
] as const)('$label', ({ input, expected }) => {
  expect(getTokenDetailBalanceStatus(input)).toBe(expected);
});

it.each([0, 12.5])('accepts a successful real balance of %s', async amount => {
  const fetchToken = jest.fn().mockResolvedValue({ ...token, amount });
  const { result } = renderHook(() =>
    useTokenDetailTokenInfo({ requestKey: requestKey(), fetchToken }),
  );
  expect(result.current.initialLoading).toBe(true);
  expect(fetchToken).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.refreshAsync();
  });
  expect(result.current.tokenInfo?.amount).toBe(amount);
  expect(result.current.initialLoading).toBe(false);
});

it('settles a failed initial request as unavailable and allows retry', async () => {
  const fetchToken = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(token);
  const { result } = renderHook(() =>
    useTokenDetailTokenInfo({ requestKey: requestKey(), fetchToken }),
  );
  await act(async () => {
    await result.current.refreshAsync();
  });
  expect(result.current.tokenInfo).toBeUndefined();
  expect(result.current.initialLoading).toBe(false);
  await act(async () => {
    await result.current.refreshAsync();
  });
  expect(result.current.tokenInfo?.amount).toBe(0);
});

it('keeps an already fetched balance when a later refresh fails', async () => {
  const fetchToken = jest
    .fn()
    .mockResolvedValueOnce({ ...token, amount: 2 })
    .mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() =>
    useTokenDetailTokenInfo({ requestKey: requestKey(), fetchToken }),
  );
  await act(async () => {
    await result.current.refreshAsync();
    await result.current.refreshAsync();
  });
  expect(result.current.tokenInfo?.amount).toBe(2);
  expect(result.current.initialLoading).toBe(false);
});

it.each([requestKey('owner-b'), requestKey('owner-a', 'other-token')])(
  'does not show a previously fetched balance after the scope changes: %s',
  async nextKey => {
    const fetchToken = jest.fn().mockResolvedValue({ ...token, amount: 2 });
    const { result, rerender } = renderHook(
      ({ key }) => useTokenDetailTokenInfo({ requestKey: key, fetchToken }),
      { initialProps: { key: requestKey() } },
    );
    await act(async () => {
      await result.current.refreshAsync();
    });
    rerender({ key: nextKey });
    expect(result.current.tokenInfo).toBeUndefined();
    expect(result.current.initialLoading).toBe(true);
  },
);

it('does not inherit a failed state from another account', async () => {
  const fetchToken = jest.fn().mockRejectedValue(new Error('offline'));
  const { result, rerender } = renderHook(
    ({ key }) => useTokenDetailTokenInfo({ requestKey: key, fetchToken }),
    { initialProps: { key: requestKey() } },
  );
  await act(async () => {
    await result.current.refreshAsync();
  });
  rerender({ key: requestKey('owner-b') });
  expect(result.current.initialLoading).toBe(true);
});

it('ignores a previous scope response that arrives after the new one', async () => {
  let resolveOld: (value: ITokenItem) => void = () => undefined;
  const fetchToken = jest
    .fn()
    .mockImplementationOnce(
      () => new Promise<ITokenItem>(resolve => (resolveOld = resolve)),
    )
    .mockResolvedValueOnce({ ...token, amount: 3 });
  const { result, rerender } = renderHook(
    ({ key }) => useTokenDetailTokenInfo({ requestKey: key, fetchToken }),
    { initialProps: { key: requestKey() } },
  );
  act(() => {
    // Intentionally do not await: this request is canceled by the scope change.
    result.current.refreshAsync();
  });
  rerender({ key: requestKey('owner-b') });
  await act(async () => {
    await result.current.refreshAsync();
    resolveOld({ ...token, amount: 999 });
    await Promise.resolve();
  });
  expect(result.current.tokenInfo?.amount).toBe(3);
});
