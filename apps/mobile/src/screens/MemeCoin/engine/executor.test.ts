import {
  createMemeTradeExecutor,
  type BroadcastResult,
  type LegRunner,
} from './executor';
import { ExecutionStoppedError } from './pauseGate';
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
  const executor = createMemeTradeExecutor(
    legs,
    runner,
    {
      onLegState: (key, state) => {
        states[key] = state;
      },
      onFinished: () => {
        finished += 1;
      },
    },
    { retryDelay: () => Promise.resolve() },
  );
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

describe('auto retry', () => {
  const setupAttempts = (
    attempts: Array<BroadcastResult | Error>,
    stopOnDelay = false,
  ) => {
    const states: Record<string, LegState> = {};
    const delays: number[] = [];
    let calls = 0;
    const runner: LegRunner = {
      prepareAndBroadcast: async (_leg, gate) => {
        await gate.wait();
        const next = attempts[calls++];
        if (next instanceof Error) {
          throw next;
        }
        return next;
      },
      waitForReceipt: async () => true,
      waitForArrival: async () => true,
    };
    const executor = createMemeTradeExecutor(
      [leg('a1', 'eth')],
      runner,
      {
        onLegState: (key, state) => {
          states[key] = state;
        },
        onFinished: () => undefined,
      },
      {
        retryDelay: async ms => {
          delays.push(ms);
          if (stopOnDelay) {
            executor.stop();
          }
        },
      },
    );
    return { executor, states, delays, calls: () => calls };
  };
  const ok: BroadcastResult = { ok: true, txHash: '0x1' };

  it.each(['simulationFailed', 'noQuote', 'priceImpact'] as const)(
    'retries %s until it succeeds',
    async reason => {
      const t = setupAttempts([{ ok: false, reason }, ok]);
      t.executor.start();
      await flush();
      expect(t.calls()).toBe(2);
      expect(t.delays).toEqual([1500]);
      expect(t.states.a1).toEqual({ phase: 'success', txHash: '0x1' });
    },
  );

  it('gives up after two retries and keeps the last reason', async () => {
    const fail: BroadcastResult = { ok: false, reason: 'simulationFailed' };
    const t = setupAttempts([fail, fail, fail, ok]);
    t.executor.start();
    await flush();
    expect(t.calls()).toBe(3);
    expect(t.states.a1).toEqual({
      phase: 'failed',
      failReason: 'simulationFailed',
    });
  });

  it.each([
    'gasNotEnough',
    'gasTooHigh',
    'insufficientBalance',
    'failed',
  ] as const)('does not retry %s', async reason => {
    const t = setupAttempts([{ ok: false, reason }, ok]);
    t.executor.start();
    await flush();
    expect(t.calls()).toBe(1);
    expect(t.states.a1).toEqual({ phase: 'failed', failReason: reason });
  });

  it('retries errors thrown before broadcast', async () => {
    const t = setupAttempts([new Error('network'), ok]);
    t.executor.start();
    await flush();
    expect(t.calls()).toBe(2);
    expect(t.states.a1.phase).toBe('success');
  });

  it('fails after errors keep being thrown', async () => {
    const boom = new Error('network');
    const t = setupAttempts([boom, boom, boom, ok]);
    t.executor.start();
    await flush();
    expect(t.calls()).toBe(3);
    expect(t.states.a1).toEqual({
      phase: 'failed',
      failReason: 'failed',
      txHash: undefined,
    });
  });

  it('does not retry once execution was stopped', async () => {
    const t = setupAttempts([new ExecutionStoppedError(), ok]);
    t.executor.start();
    await flush();
    expect(t.calls()).toBe(1);
    expect(t.states.a1.phase).toBe('cancelled');
  });

  it('stops retrying when stopped during the delay', async () => {
    const t = setupAttempts([{ ok: false, reason: 'noQuote' }, ok], true);
    t.executor.start();
    await flush();
    expect(t.calls()).toBe(1);
    expect(t.states.a1.phase).toBe('cancelled');
  });
});

describe('bridge arrival failure', () => {
  it('uses arrivalFailed when arrival is negative', async () => {
    const t = setup([leg('a1', 'eth', 'bridge')]);
    t.executor.start();
    await flush();
    t.prepare('a1').resolve({ ok: true, txHash: '0xb' });
    await flush();
    t.receipt('a1').resolve(true);
    await flush();
    t.arrival('a1').resolve(false);
    await flush();
    expect(t.states.a1).toEqual({
      phase: 'failed',
      failReason: 'arrivalFailed',
      txHash: '0xb',
    });
  });

  it('uses arrivalFailed when waiting for arrival throws', async () => {
    const t = setup([leg('a1', 'eth', 'bridge')]);
    t.executor.start();
    await flush();
    t.prepare('a1').resolve({ ok: true, txHash: '0xb' });
    await flush();
    t.receipt('a1').resolve(true);
    await flush();
    t.arrival('a1').reject(new Error('boom'));
    await flush();
    expect(t.states.a1).toEqual({
      phase: 'failed',
      failReason: 'arrivalFailed',
      txHash: '0xb',
    });
  });

  it('keeps failed for a reverted source tx and never retries it', async () => {
    const t = setup([leg('a1', 'eth', 'bridge')]);
    t.executor.start();
    await flush();
    t.prepare('a1').resolve({ ok: true, txHash: '0xb' });
    await flush();
    t.receipt('a1').resolve(false);
    await flush();
    expect(t.states.a1).toEqual({
      phase: 'failed',
      failReason: 'failed',
      txHash: '0xb',
    });
    expect(t.calls.filter(c => c === 'prepare:a1')).toHaveLength(1);
  });
});
