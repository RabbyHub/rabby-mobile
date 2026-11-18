import { act, cleanupAsync, renderHook } from '@testing-library/react-native';
import { InfoClient, WebSocketClient } from '@rabby-wallet/hyperliquid-sdk';
import { apisPerps } from '@/core/apis/perps';
import { usePerpsTwapSubscriptions } from './usePerpsTwapSubscriptions';
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
