import {
  createMemeTradeExecutor,
  type BroadcastResult,
  type LegRunner,
} from './executor';
import type { ExecLeg, LegState } from './types';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};
const deferred = <T>(): Deferred<T> => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const leg = (
  key: string,
  chain: string,
  kind: ExecLeg['kind'] = 'swap',
): ExecLeg => ({
  key,
  kind,
  pay: { id: key, chain, symbol: key },
  receive: { id: 'meme', chain: 'bsc', symbol: 'MEME' },
  amountUsd: 1,
  payAll: false,
});

const setup = (legs: ExecLeg[]) => {
  const prepare = new Map<string, Deferred<BroadcastResult>>();
  const receipt = new Map<string, Deferred<boolean>>();
  const arrival = new Map<string, Deferred<boolean>>();
  const get = <T>(map: Map<string, Deferred<T>>, key: string) => {
    if (!map.has(key)) {
      map.set(key, deferred<T>());
    }
    return map.get(key)!;
  };
  const calls: string[] = [];
  const runner: LegRunner = {
    prepareAndBroadcast: leg => {
      calls.push(`prepare:${leg.key}`);
      return get(prepare, leg.key).promise;
    },
    waitForReceipt: leg => {
      calls.push(`receipt:${leg.key}`);
      return get(receipt, leg.key).promise;
    },
    waitForArrival: leg => {
      calls.push(`arrival:${leg.key}`);
      return get(arrival, leg.key).promise;
    },
  };
  const states: Record<string, LegState> = {};
  let finished = 0;
  const executor = createMemeTradeExecutor(legs, runner, {
    onLegState: (key, state) => {
      states[key] = state;
    },
    onFinished: () => {
      finished += 1;
    },
  });
  return {
    executor,
    calls,
    states,
    finished: () => finished,
    prepare: (k: string) => get(prepare, k),
    receipt: (k: string) => get(receipt, k),
    arrival: (k: string) => get(arrival, k),
  };
};

describe('createMemeTradeExecutor', () => {
  it('runs chains in parallel and legs on the same chain one by one', async () => {
    const t = setup([leg('a1', 'eth'), leg('a2', 'eth'), leg('b1', 'bsc')]);
    t.executor.start();
    await flush();
    expect(t.calls).toEqual(['prepare:a1', 'prepare:b1']);
    expect(t.states.a2.phase).toBe('queued');

    t.prepare('a1').resolve({ ok: true, txHash: '0x1' });
    await flush();
    expect(t.states.a1).toEqual({ phase: 'confirming', txHash: '0x1' });
    expect(t.calls).not.toContain('prepare:a2');

    t.receipt('a1').resolve(true);
    await flush();
    expect(t.states.a1).toEqual({ phase: 'success', txHash: '0x1' });
    expect(t.calls).toContain('prepare:a2');
  });

  it('releases the chain after the bridge source tx is mined and waits for arrival separately', async () => {
    const t = setup([leg('a1', 'eth', 'bridge'), leg('a2', 'eth')]);
    t.executor.start();
    await flush();
    t.prepare('a1').resolve({ ok: true, txHash: '0xb' });
    await flush();
    t.receipt('a1').resolve(true);
    await flush();
    expect(t.states.a1.phase).toBe('arriving');
    expect(t.calls).toContain('prepare:a2');

    t.prepare('a2').resolve({ ok: true, txHash: '0xs' });
    await flush();
    t.receipt('a2').resolve(true);
    await flush();
    expect(t.finished()).toBe(0);

    t.arrival('a1').resolve(true);
    await flush();
    expect(t.states.a1.phase).toBe('success');
    expect(t.finished()).toBe(1);
  });

  it('marks failures and moves on to the next leg', async () => {
    const t = setup([leg('a1', 'eth'), leg('a2', 'eth'), leg('a3', 'eth')]);
    t.executor.start();
    await flush();
    t.prepare('a1').resolve({ ok: false, reason: 'noQuote' });
    await flush();
    expect(t.states.a1).toEqual({ phase: 'failed', failReason: 'noQuote' });

    t.prepare('a2').resolve({ ok: true, txHash: '0x2' });
    await flush();
    t.receipt('a2').resolve(false);
    await flush();
    expect(t.states.a2).toEqual({
      phase: 'failed',
      failReason: 'failed',
      txHash: '0x2',
    });

    t.prepare('a3').reject(new Error('boom'));
    await flush();
    expect(t.states.a3).toEqual({
      phase: 'failed',
      failReason: 'failed',
      txHash: undefined,
    });
    expect(t.finished()).toBe(1);
  });

  it('holds legs while paused and continues from there on resume', async () => {
    const t = setup([leg('a1', 'eth'), leg('a2', 'eth')]);
    t.executor.pause();
    t.executor.start();
    await flush();
    expect(t.calls).toEqual([]);
    expect(t.states.a1.phase).toBe('queued');

    t.executor.resume();
    await flush();
    t.prepare('a1').resolve({ ok: true, txHash: '0x1' });
    await flush();
    t.executor.pause();
    t.receipt('a1').resolve(true);
    await flush();
    expect(t.states.a1.phase).toBe('success');
    expect(t.states.a2.phase).toBe('queued');
    expect(t.calls).not.toContain('prepare:a2');

    t.executor.resume();
    await flush();
    expect(t.calls).toContain('prepare:a2');
  });

  it('cancels legs that have not been broadcast when stopped', async () => {
    const t = setup([leg('a1', 'eth'), leg('a2', 'eth'), leg('b1', 'bsc')]);
    t.executor.pause();
    t.executor.start();
    await flush();
    t.executor.stop();
    await flush();
    expect(Object.values(t.states).map(s => s.phase)).toEqual([
      'cancelled',
      'cancelled',
      'cancelled',
    ]);
    expect(t.finished()).toBe(1);
  });
});
