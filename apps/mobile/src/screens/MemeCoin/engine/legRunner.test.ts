import BigNumber from 'bignumber.js';
import type { TokenItem, Tx } from '@rabby-wallet/rabby-api/dist/types';
import {
  createLegRunner,
  type LegRunnerDeps,
  type RouteAdapter,
} from './legRunner';
import { createPauseGate, ExecutionStoppedError } from './pauseGate';
import type { ExecLeg } from './types';

const token = (
  id: string,
  chain: string,
  price: number,
  balance: number,
  decimals = 18,
): TokenItem =>
  ({
    id,
    chain,
    symbol: id.toUpperCase(),
    decimals,
    price,
    raw_amount_hex_str: new BigNumber(balance)
      .times(new BigNumber(10).pow(decimals))
      .toString(16),
  } as unknown as TokenItem);

const leg = (over: Partial<ExecLeg> = {}): ExecLeg => ({
  key: 'k',
  kind: 'swap',
  pay: { id: 'usdt', chain: 'eth', symbol: 'USDT' },
  receive: { id: 'pepe', chain: 'eth', symbol: 'PEPE' },
  amountUsd: 50,
  payAll: false,
  ...over,
});

const TXS = [{ to: '0xapprove' }, { to: '0xswap' }] as unknown as Tx[];

const setup = (
  over: Partial<LegRunnerDeps> = {},
  routeOver: Partial<RouteAdapter> = {},
) => {
  const tokens: Record<string, TokenItem> = {
    usdt: token('usdt', 'eth', 2, 100),
    eth: token('eth', 'eth', 2, 10),
    pepe: token('pepe', 'eth', 1, 0),
  };
  const signer = {
    prefetch: jest.fn(async () => undefined),
    openDirect: jest.fn(async () => ['0xa', '0xmain']),
    close: jest.fn(),
  };
  const onBroadcast = jest.fn(async () => undefined);
  const build = jest.fn(async () => TXS);
  const route: RouteAdapter = {
    quote: jest.fn(async ({ payAmount }) => ({
      receiveAmount: payAmount.times(2),
      build,
      onBroadcast,
    })),
    ...routeOver,
  };
  const deps: LegRunnerDeps = {
    maxPriceImpactPct: 5,
    routes: { swap: route, bridge: route },
    getToken: async (_chain, id) => tokens[id],
    isNativeToken: (_chain, id) => id === 'eth',
    isTwoStepChain: () => false,
    getNativeGasReserve: async () => new BigNumber(0.5),
    getSigner: () => signer,
    classifySignError: e =>
      e === 'Gas not enough' ? 'gasNotEnough' : 'failed',
    waitForTxCompleted: jest.fn(async () => true),
    waitForBridgeArrival: jest.fn(async () => true),
    refreshAutoLock: jest.fn(),
    ...over,
  };
  return {
    runner: createLegRunner(deps),
    deps,
    route,
    signer,
    build,
    onBroadcast,
  };
};

describe('createLegRunner.prepareAndBroadcast', () => {
  it('quotes the planned USD amount with half the max price impact as slippage, then signs', async () => {
    const t = setup();
    await expect(
      t.runner.prepareAndBroadcast(leg(), createPauseGate()),
    ).resolves.toEqual({ ok: true, txHash: '0xmain' });
    const quoteArgs = (t.route.quote as jest.Mock).mock.calls[0][0];
    expect(quoteArgs.payAmount.toNumber()).toBe(25);
    expect(quoteArgs.slippagePct).toBe(2.5);
    expect(t.signer.prefetch).toHaveBeenCalledWith(TXS);
    expect(t.signer.openDirect).toHaveBeenCalledWith(TXS);
    expect(t.signer.close).toHaveBeenCalled();
    expect(t.onBroadcast).toHaveBeenCalledWith('0xmain');
    expect(t.deps.refreshAutoLock).toHaveBeenCalled();
  });

  it('caps a native pay amount at balance minus gas reserve', async () => {
    const t = setup();
    await t.runner.prepareAndBroadcast(
      leg({ pay: { id: 'eth', chain: 'eth', symbol: 'ETH' } }),
      createPauseGate(),
    );
    expect(
      (t.route.quote as jest.Mock).mock.calls[0][0].payAmount.toNumber(),
    ).toBe(9.5);
  });

  it('spends the whole balance for sell legs', async () => {
    const t = setup();
    await t.runner.prepareAndBroadcast(
      leg({ payAll: true }),
      createPauseGate(),
    );
    expect(
      (t.route.quote as jest.Mock).mock.calls[0][0].payAmount.toNumber(),
    ).toBe(100);
  });

  it('fails with insufficientBalance before quoting when nothing can be paid', async () => {
    const t = setup({ getNativeGasReserve: async () => new BigNumber(20) });
    await expect(
      t.runner.prepareAndBroadcast(
        leg({ pay: { id: 'eth', chain: 'eth', symbol: 'ETH' } }),
        createPauseGate(),
      ),
    ).resolves.toEqual({ ok: false, reason: 'insufficientBalance' });
    expect(t.route.quote).not.toHaveBeenCalled();
  });

  it('fails with noQuote when the route has no quote', async () => {
    const t = setup({}, { quote: async () => null });
    await expect(
      t.runner.prepareAndBroadcast(leg(), createPauseGate()),
    ).resolves.toEqual({ ok: false, reason: 'noQuote' });
  });

  it('fails with priceImpact when the quote loses at least half the max impact', async () => {
    const lossy = setup(
      {},
      {
        quote: async ({ payAmount }) => ({
          receiveAmount: payAmount.times(2 * 0.97),
          build: async () => TXS,
        }),
      },
    );
    await expect(
      lossy.runner.prepareAndBroadcast(leg(), createPauseGate()),
    ).resolves.toEqual({ ok: false, reason: 'priceImpact' });
    const fine = setup(
      {},
      {
        quote: async ({ payAmount }) => ({
          receiveAmount: payAmount.times(2 * 0.98),
          build: async () => TXS,
        }),
      },
    );
    await expect(
      fine.runner.prepareAndBroadcast(leg(), createPauseGate()),
    ).resolves.toMatchObject({ ok: true });
  });

  it('fails when build returns nothing', async () => {
    const t = setup(
      {},
      {
        quote: async ({ payAmount }) => ({
          receiveAmount: payAmount.times(2),
          build: async () => undefined,
        }),
      },
    );
    await expect(
      t.runner.prepareAndBroadcast(leg(), createPauseGate()),
    ).resolves.toEqual({ ok: false, reason: 'failed' });
  });

  it('maps sign errors and always closes the signer', async () => {
    const t = setup();
    t.signer.openDirect.mockRejectedValueOnce('Gas not enough');
    await expect(
      t.runner.prepareAndBroadcast(leg(), createPauseGate()),
    ).resolves.toEqual({ ok: false, reason: 'gasNotEnough' });
    expect(t.signer.close).toHaveBeenCalled();
  });

  it('signs each tx separately on two-step chains and waits for the intermediate receipt', async () => {
    const t = setup({ isTwoStepChain: () => true });
    t.signer.openDirect
      .mockResolvedValueOnce(['0xa'])
      .mockResolvedValueOnce(['0xmain']);
    await expect(
      t.runner.prepareAndBroadcast(leg(), createPauseGate()),
    ).resolves.toEqual({ ok: true, txHash: '0xmain' });
    expect(t.signer.openDirect).toHaveBeenNthCalledWith(1, [TXS[0]]);
    expect(t.signer.openDirect).toHaveBeenNthCalledWith(2, [TXS[1]]);
    expect(t.deps.waitForTxCompleted).toHaveBeenCalledTimes(1);
  });

  it('keeps the quote while paused and continues from there on resume', async () => {
    const gate = createPauseGate();
    const build = jest.fn(async () => TXS);
    const t = setup(
      {},
      {
        quote: jest.fn(async ({ payAmount }) => {
          gate.pause();
          return { receiveAmount: payAmount.times(2), build };
        }),
      },
    );
    const result = t.runner.prepareAndBroadcast(leg(), gate);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(build).not.toHaveBeenCalled();
    gate.resume();
    await expect(result).resolves.toMatchObject({ ok: true });
    expect(t.route.quote).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('propagates stop as ExecutionStoppedError', async () => {
    const gate = createPauseGate();
    gate.stop();
    await expect(
      setup().runner.prepareAndBroadcast(leg(), gate),
    ).rejects.toBeInstanceOf(ExecutionStoppedError);
  });
});
