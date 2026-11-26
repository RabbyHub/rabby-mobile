import { act, cleanupAsync, renderHook } from '@testing-library/react-native';
import { InfoClient, WebSocketClient } from '@rabby-wallet/hyperliquid-sdk';
import { apisPerps } from '@/core/apis/perps';
import {
  refreshPerpsTwaps,
  usePerpsTwapSubscriptions,
} from './usePerpsTwapSubscriptions';
import { getPerpsTwapAccount, perpsTwapStore } from './usePerpsTwapStore';
import { parsePerpsTwapHistory } from './twapReconciliation';
import { loadPerpsTwapFills } from './twapRepository';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.useFakeTimers();
const userA = '0x00000000000000000000000000000000000000aa';
const userB = '0x00000000000000000000000000000000000000bb';
const state = (user = userA) => ({
  coin: 'ETH',
  user,
  side: 'B' as const,
  sz: '2',
  executedSz: '0',
  executedNtl: '0',
  minutes: 5,
  timestamp: 100000,
  randomize: false,
  reduceOnly: false,
});
type Channel = 'states' | 'history' | 'fills';
type Listener = {
  channel: Channel;
  user: string;
  live: boolean;
  emit: (value: unknown) => void;
};
let listeners: Listener[];
function subscribe(
  channel: Channel,
  user: string | undefined,
  callback: Function,
) {
  const listener = {
    channel,
    user: user!,
    live: true,
    emit: (value: unknown) => callback(value),
  };
  listeners.push(listener);
  return {
    id: `${channel}:${user}`,
    unsubscribe: () => {
      listener.live = false;
    },
  };
}
const listener = (channel: Channel, user = userA) =>
  listeners
    .filter(item => item.live && item.channel === channel && item.user === user)
    .at(-1)!;
const fill = (tid: number, time = 101000) => ({
  twapId: 7,
  fill: {
    coin: 'ETH',
    tid,
    oid: 9,
    time,
    side: 'B',
    px: '100',
    sz: '1',
    fee: '0.01',
    feeToken: 'USDC',
  },
});
beforeEach(() => {
  listeners = [];
  perpsTwapStore.setState({ accounts: {}, receipts: {} });
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => [{ universe: [], marginTables: [] }],
  } as Response);
  jest.spyOn(InfoClient.prototype, 'getUserTwapHistory').mockResolvedValue([]);
  jest
    .spyOn(InfoClient.prototype, 'getUserTwapSliceFills')
    .mockResolvedValue([]);
  jest
    .spyOn(WebSocketClient.prototype, 'subscribeToTwapStates')
    .mockImplementation((callback, user) =>
      subscribe('states', user, callback),
    );
  jest
    .spyOn(WebSocketClient.prototype, 'subscribeToUserTwapHistory')
    .mockImplementation((callback, user) =>
      subscribe('history', user, callback),
    );
  jest
    .spyOn(WebSocketClient.prototype, 'subscribeToUserTwapSliceFills')
    .mockImplementation((callback, user) => subscribe('fills', user, callback));
});
afterEach(async () => {
  await cleanupAsync();
  apisPerps.destroyPerpsSDK();
  jest.restoreAllMocks();
  jest.clearAllTimers();
});
afterAll(() => jest.useRealTimers());

test('shares account subscriptions, rejects foreign and stale generation data, and releases inactive consumers', async () => {
  const first = renderHook(
    ({ user, generation, enabled }) =>
      usePerpsTwapSubscriptions(user, enabled, generation),
    { initialProps: { user: userA, generation: 1, enabled: true } },
  );
  const second = renderHook(() => usePerpsTwapSubscriptions(userA, true, 1));
  await act(async () => {});
  expect(listeners.filter(item => item.live)).toHaveLength(3);
  const old = listener('states');
  act(() => old.emit({ user: userB, states: [[7, state(userB)]] }));
  expect(getPerpsTwapAccount(userA).records).toEqual({});
  act(() => old.emit({ user: userA.toUpperCase(), states: [[7, state()]] }));
  expect(getPerpsTwapAccount(userA).records['ETH:7'].active).toBe(true);
  act(() =>
    listener('fills').emit({ user: userA, twapSliceFills: [fill(1), fill(2)] }),
  );
  const fills = getPerpsTwapAccount(userA).fills;
  expect(fills['ETH:7']).toHaveLength(2);
  act(() =>
    listener('fills').emit({ user: userA, twapSliceFills: [fill(1), fill(2)] }),
  );
  expect(getPerpsTwapAccount(userA).fills).toBe(fills);
  second.unmount();
  expect(listeners.filter(item => item.live)).toHaveLength(3);
  first.rerender({ user: userA, generation: 2, enabled: true });
  await act(async () => {});
  act(() => listener('states').emit({ user: userA, states: [] }));
  act(() => old.emit({ user: userA, states: [[7, state()]] }));
  expect(getPerpsTwapAccount(userA).records['ETH:7'].active).toBe(false);
  first.rerender({ user: userB, generation: 3, enabled: true });
  await act(async () => {});
  expect(getPerpsTwapAccount(userB).records).toEqual({});
  first.rerender({ user: userB, generation: 3, enabled: false });
  expect(listeners.filter(item => item.live)).toHaveLength(0);
});

const terminalEvent = (twapId: number) => ({
  twapId,
  time: 102,
  state: state(),
  status: { status: 'finished' },
});

test('loads history despite rejected fills and a failed active subscription; retry is scoped to history', async () => {
  const history = jest
    .mocked(InfoClient.prototype.getUserTwapHistory)
    .mockResolvedValue([terminalEvent(7)]);
  const fills = jest
    .mocked(InfoClient.prototype.getUserTwapSliceFills)
    .mockRejectedValue(new Error('fills offline'));
  jest
    .mocked(WebSocketClient.prototype.subscribeToTwapStates)
    .mockImplementationOnce(() => {
      throw new Error('active offline');
    });
  renderHook(() => usePerpsTwapSubscriptions(userA, true, 1));
  await act(async () => {});
  const account = () => getPerpsTwapAccount(userA);
  expect(account().sources).toEqual({
    history: { ready: true, error: null },
    fills: { ready: false, error: expect.stringContaining('fills offline') },
    active: { ready: false, error: expect.stringContaining('active offline') },
  });
  expect(account().records['ETH:7'].status).toBe('finished');
  history.mockResolvedValueOnce([{}] as never);
  await act(async () => {
    await Promise.all([
      refreshPerpsTwaps(userA, 'history'),
      refreshPerpsTwaps(userA, 'history'),
    ]);
  });
  expect(history).toHaveBeenCalledTimes(2);
  expect(fills).toHaveBeenCalledTimes(1);
  expect(account().sources.history).toEqual({
    ready: true,
    error: expect.stringContaining('Invalid TWAP history event'),
  });
  expect(account().records['ETH:7'].status).toBe('finished');
  act(() =>
    listener('history').emit({ user: userA, isSnapshot: true, history: [] }),
  );
  expect(account().sources.history.error).toBeNull();
});

test('a valid empty WS history snapshot survives a late HTTP error; other channels cannot clear a history error', async () => {
  let rejectHistory!: (error: Error) => void;
  const history = jest
    .mocked(InfoClient.prototype.getUserTwapHistory)
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectHistory = reject;
        }),
    );
  renderHook(() => usePerpsTwapSubscriptions(userA, true, 1));
  const account = () => getPerpsTwapAccount(userA);
  act(() => listener('history').emit({ user: userA, history: [] }));
  expect(account().sources.history.ready).toBe(false);
  act(() =>
    listener('history').emit({ user: userA, isSnapshot: true, history: [] }),
  );
  await act(async () => rejectHistory(new Error('late history error')));
  expect(account().sources.history).toEqual({ ready: true, error: null });
  history.mockRejectedValueOnce(new Error('history offline'));
  await act(async () => {
    await refreshPerpsTwaps(userA, 'history');
  });
  act(() => listener('states').emit({ user: userA, states: [] }));
  act(() =>
    listener('fills').emit({
      user: userA,
      isSnapshot: true,
      twapSliceFills: [],
    }),
  );
  expect(account().sources.history).toEqual({
    ready: true,
    error: expect.stringContaining('history offline'),
  });
  await act(async () => {
    await refreshPerpsTwaps(userA, 'history');
  });
  expect(account().sources.history).toEqual({ ready: true, error: null });
});

test('merges the full REST backfill after a smaller WS snapshot', async () => {
  let resolveHistory!: (events: ReturnType<typeof terminalEvent>[]) => void;
  jest.mocked(InfoClient.prototype.getUserTwapHistory).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveHistory = resolve;
      }),
  );
  renderHook(() => usePerpsTwapSubscriptions(userA, true, 1));
  act(() =>
    listener('history').emit({
      user: userA,
      isSnapshot: true,
      history: [terminalEvent(8)],
    }),
  );
  await act(async () => resolveHistory([terminalEvent(7)]));
  expect(Object.keys(getPerpsTwapAccount(userA).records).sort()).toEqual([
    'ETH:7',
    'ETH:8',
  ]);
});

test('a valid history delta recovers rows without claiming a full snapshot or accepting an older HTTP error', async () => {
  let rejectHistory!: (error: Error) => void;
  jest.mocked(InfoClient.prototype.getUserTwapHistory).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectHistory = reject;
      }),
  );
  renderHook(() => usePerpsTwapSubscriptions(userA, true, 1));
  const account = () => getPerpsTwapAccount(userA);
  act(() => listener('history').emit({ user: userA, history: [{}] }));
  expect(account().sources.history.error).toBeTruthy();
  act(() => listener('history').emit({ user: userA, history: [] }));
  expect(account().sources.history.error).toBeTruthy();
  act(() =>
    listener('history').emit({ user: userA, history: [terminalEvent(7)] }),
  );
  await act(async () => rejectHistory(new Error('late history error')));
  expect(account().sources.history).toEqual({ ready: false, error: null });
  expect(account().records['ETH:7']).toBeDefined();
  await act(async () => {
    await refreshPerpsTwaps(userA, 'history');
  });
  expect(account().sources.history).toEqual({ ready: true, error: null });
  expect(account().records['ETH:7']).toBeDefined();
});

test.each(['activated', 'waitingForTrigger'])(
  'an %s delta cannot hide a failed initial history snapshot',
  async status => {
    let rejectHistory!: (error: Error) => void;
    jest.mocked(InfoClient.prototype.getUserTwapHistory).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectHistory = reject;
        }),
    );
    renderHook(() => usePerpsTwapSubscriptions(userA, true, 1));
    act(() =>
      listener('history').emit({
        user: userA,
        history: [{ ...terminalEvent(7), status: { status } }],
      }),
    );
    await act(async () => rejectHistory(new Error('history offline')));
    expect(getPerpsTwapAccount(userA).sources.history).toEqual({
      ready: false,
      error: expect.stringContaining('history offline'),
    });
  },
);

test('keeps overlapping millisecond boundaries and proves terminal completeness from executed size', async () => {
  const order = parsePerpsTwapHistory(
    {
      twapId: 7,
      time: 102,
      state: { ...state(), executedSz: '2', executedNtl: '200' },
      status: { status: 'finished' },
    },
    userA,
  )!;
  const transport = jest
    .spyOn(InfoClient.prototype, 'getUserTwapSliceFillsByTime')
    .mockResolvedValueOnce([fill(1)] as never)
    .mockResolvedValueOnce([fill(1), fill(2)] as never);
  const result = await loadPerpsTwapFills(userA, order, () => true);
  expect(result.complete).toBe(true);
  expect(result.fills.map(item => item.tid)).toEqual([2, 1]);
  expect(transport.mock.calls.map(call => call[1])).toEqual([100000, 101000]);
  transport.mockReset().mockResolvedValue([fill(1)] as never);
  expect((await loadPerpsTwapFills(userA, order, () => true)).complete).toBe(
    false,
  );
  transport.mockReset().mockResolvedValue([]);
  expect((await loadPerpsTwapFills(userA, order, () => true)).complete).toBe(
    false,
  );
});
