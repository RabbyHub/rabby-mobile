import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { getLegDisplayStatuses } from '../engine/displayStatus';
import type { BroadcastResult, LegRunner } from '../engine/executor';
import type { ExecLeg } from '../engine/types';
import { createProductionLegRunnerDeps } from '../engine/deps';
import { useMemeTradeTask } from './useMemeTradeTask';

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.requireActual('zustand').create,
}));
jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));
jest.mock('@/screens/Swap/hooks/quote', () => ({
  useQuoteMethods: () => ({ getDexQuote: jest.fn() }),
}));
jest.mock('@/screens/Swap/hooks/settings', () => ({
  useSwapSupportedDexList: () => [[]],
}));
jest.mock('../engine/deps', () => ({
  createProductionLegRunnerDeps: jest.fn(),
}));
jest.mock('../engine/legRunner', () => ({
  createLegRunner: () => mockRunner,
}));

type Deferred = { promise: Promise<void>; release: () => void };
const deferred = (): Deferred => {
  let release!: () => void;
  const promise = new Promise<void>(res => {
    release = res;
  });
  return { promise, release };
};

// Per-leg scripted results; `holds` keeps a leg's prepare pending until released.
let prepareResults: Record<string, BroadcastResult[]> = {};
let arrivals: Record<string, boolean> = {};
let holds: Record<string, Deferred> = {};
let prepareCalls: string[] = [];

const mockRunner: LegRunner = {
  prepareAndBroadcast: async l => {
    prepareCalls.push(l.key);
    await holds[l.key]?.promise;
    return prepareResults[l.key].shift()!;
  },
  waitForReceipt: async () => true,
  waitForArrival: async l => arrivals[l.key] ?? true,
};

const mockCreateDeps = createProductionLegRunnerDeps as jest.Mock;

const leg = (
  key: string,
  kind: ExecLeg['kind'] = 'swap',
  chain = 'eth',
): ExecLeg => ({
  key,
  kind,
  pay: { id: key, chain, symbol: key },
  receive: { id: 'meme', chain: 'bsc', symbol: 'MEME' },
  amountUsd: 1,
  payAll: false,
});

const ok: BroadcastResult = { ok: true, txHash: '0x1' };
const failed: BroadcastResult = { ok: false, reason: 'failed' };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const setup = (legs: ExecLeg[]) => {
  const hook = renderHook(() =>
    useMemeTradeTask({
      account: {} as Parameters<typeof useMemeTradeTask>[0]['account'],
      legs,
      maxPriceImpactPct: 5,
    }),
  );
  const state = () => hook.result.current.store.getState();
  const settle = () => act(async () => void (await flush()));
  return { hook, state, settle };
};

describe('useMemeTradeTask manual retry', () => {
  beforeEach(() => {
    // the lifecycle controller pauses the executor while the app is not active
    (AppState as { currentState: string }).currentState = 'active';
    prepareResults = {};
    arrivals = {};
    holds = {};
    prepareCalls = [];
    mockCreateDeps.mockReset();
    mockCreateDeps.mockImplementation(() => ({ deps: {}, dispose: jest.fn() }));
  });

  it('ignores retry for a leg that has not failed', async () => {
    holds.a = deferred();
    prepareResults.a = [failed];
    const { hook, state, settle } = setup([leg('a')]);
    act(() => hook.result.current.start());
    await settle();
    expect(state().status).toBe('running');

    act(() => hook.result.current.retry(['a']));
    await settle();
    expect(mockCreateDeps).toHaveBeenCalledTimes(1);

    holds.a.release();
    await settle();
    expect(state().status).toBe('finished');
  });

  it('retries a failed leg right away while another chain is still running', async () => {
    holds.b = deferred();
    prepareResults.a = [failed, ok];
    prepareResults.b = [ok];
    const { hook, state, settle } = setup([
      leg('a', 'swap', 'eth'),
      leg('b', 'swap', 'bsc'),
    ]);
    act(() => hook.result.current.start());
    await settle();
    expect(state().states.a.phase).toBe('failed');
    expect(state().status).toBe('running');

    act(() => hook.result.current.retry(['a']));
    await settle();
    expect(state().states.a.phase).toBe('success');
    expect(state().status).toBe('running');
    expect(mockCreateDeps).toHaveBeenCalledTimes(1);

    holds.b.release();
    await settle();
    expect(state().status).toBe('finished');
  });

  it('keeps a retried leg waiting behind the leg running on its chain', async () => {
    holds.b = deferred();
    prepareResults.a = [failed, ok];
    prepareResults.b = [ok];
    const legs = [leg('a'), leg('b')];
    const { hook, state, settle } = setup(legs);
    act(() => hook.result.current.start());
    await settle();
    expect(state().states.a.phase).toBe('failed');
    expect(state().states.b.phase).toBe('preparing');

    act(() => hook.result.current.retry(['a']));
    await settle();
    expect(state().states.a.phase).toBe('queued');
    expect(getLegDisplayStatuses(legs, state().states).a).toBe(
      'pendingPrevious',
    );
    expect(prepareCalls).toEqual(['a', 'b']);

    holds.b.release();
    await settle();
    expect(prepareCalls).toEqual(['a', 'b', 'a']);
    expect(state().states.a.phase).toBe('success');
    expect(state().status).toBe('finished');
  });

  it('queues the leg once when it is tapped twice', async () => {
    holds.b = deferred();
    prepareResults.a = [failed, ok, ok];
    prepareResults.b = [ok];
    const { hook, settle } = setup([leg('a'), leg('b')]);
    act(() => hook.result.current.start());
    await settle();

    act(() => {
      hook.result.current.retry(['a']);
      hook.result.current.retry(['a']);
    });
    holds.b.release();
    await settle();
    expect(prepareCalls).toEqual(['a', 'b', 'a']);
  });

  it('re-runs only the failed leg and keeps the success leg untouched', async () => {
    prepareResults.a = [ok];
    prepareResults.b = [failed, ok];
    const { hook, state, settle } = setup([leg('a'), leg('b')]);
    act(() => hook.result.current.start());
    await settle();
    expect(state().states.a.phase).toBe('success');
    expect(state().states.b.phase).toBe('failed');

    act(() => hook.result.current.retry(['a', 'b']));
    await settle();
    expect(mockCreateDeps).toHaveBeenCalledTimes(2);
    expect(prepareCalls).toEqual(['a', 'b', 'b']);
    expect(state().states.a.phase).toBe('success');
    expect(state().states.b.phase).toBe('success');
  });

  it('does not re-run a bridge leg whose arrival failed', async () => {
    prepareResults.a = [ok];
    arrivals.a = false;
    const { hook, state, settle } = setup([leg('a', 'bridge')]);
    act(() => hook.result.current.start());
    await settle();
    expect(state().states.a).toMatchObject({
      phase: 'failed',
      failReason: 'arrivalFailed',
    });
    expect(state().status).toBe('finished');

    act(() => hook.result.current.retry(['a']));
    await settle();
    expect(mockCreateDeps).toHaveBeenCalledTimes(1);
    expect(state().status).toBe('finished');
    expect(prepareCalls).toEqual(['a']);
  });

  it('puts the retried leg back to queued and the task back to running', async () => {
    prepareResults.a = [failed, ok];
    const { hook, state, settle } = setup([leg('a')]);
    act(() => hook.result.current.start());
    await settle();
    expect(state().status).toBe('finished');
    expect(state().states.a.phase).toBe('failed');

    holds.a = deferred();
    act(() => hook.result.current.retry(['a']));
    expect(state().status).toBe('running');
    expect(state().states.a.phase).toBe('queued');
    await settle();
    expect(state().states.a.phase).toBe('preparing');

    holds.a.release();
    await settle();
    expect(state().states.a.phase).toBe('success');
    expect(state().status).toBe('finished');
  });

  it('stopAndExit during the second run cancels the queued leg', async () => {
    prepareResults.a = [failed, failed];
    prepareResults.b = [failed];
    const { hook, state, settle } = setup([leg('a'), leg('b')]);
    act(() => hook.result.current.start());
    await settle();
    expect(state().status).toBe('finished');

    holds.a = deferred();
    act(() => hook.result.current.retry(['a', 'b']));
    await settle();
    expect(state().states.a.phase).toBe('preparing');
    expect(state().states.b.phase).toBe('queued');

    act(() => hook.result.current.stopAndExit());
    holds.a.release();
    await settle();
    expect(state().states.b.phase).toBe('cancelled');
    expect(prepareCalls).toEqual(['a', 'b', 'a']);
    expect(state().status).toBe('finished');
  });
});
