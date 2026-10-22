import { computeMemeTargets, planBuy } from './planner';
import type {
  ChainGasInfo,
  MemeTarget,
  PaymentAsset,
  PlanInput,
} from './types';

const meme = (
  symbol: string,
  chain: string,
  marketCap: number,
): MemeTarget => ({
  id: `0x${symbol.toLowerCase()}`,
  chain,
  symbol,
  marketCap,
});

const asset = (
  symbol: string,
  chain: string,
  usdValue: number,
  over: Partial<PaymentAsset> = {},
): PaymentAsset => ({
  id: `${chain}-${symbol.toLowerCase()}`,
  chain,
  symbol,
  usdValue,
  price: 1,
  isNative: false,
  isMainstream: ['USDT', 'USDC'].includes(symbol),
  ...over,
});

const gas = (over: Partial<ChainGasInfo> = {}): ChainGasInfo => ({
  perLegGasUsd: 0,
  nativeBalanceUsd: 100,
  bridgeSupported: true,
  ...over,
});

const input = (over: Partial<PlanInput>): PlanInput => ({
  amountUsd: 100,
  memes: [],
  sources: [],
  chainGas: {},
  gasAccountBalanceUsd: 0,
  ...over,
});

const PEPE = meme('PEPE', 'eth', 600_000_000);
const BONK = meme('BONK', 'bsc', 400_000_000);

describe('computeMemeTargets', () => {
  it('splits by market cap', () => {
    expect(computeMemeTargets(100, [PEPE, BONK]).map(t => t.amountUsd)).toEqual(
      [60, 40],
    );
  });

  it('splits equally when no market cap is known', () => {
    const targets = computeMemeTargets(90, [
      meme('A', 'eth', 0),
      meme('B', 'eth', 0),
      meme('C', 'eth', 0),
    ]);
    expect(targets.map(t => t.amountUsd)).toEqual([30, 30, 30]);
  });
});

describe('planBuy', () => {
  it('returns an empty plan when there is nothing to buy', () => {
    expect(planBuy(input({ amountUsd: 0, memes: [PEPE] })).legs).toEqual([]);
    expect(planBuy(input({ memes: [] })).shortfallUsd).toBe(100);
  });

  it('pays a same-chain meme with one swap and reserves gas from the native token', () => {
    const plan = planBuy(
      input({
        amountUsd: 50,
        memes: [PEPE],
        sources: [
          asset('ETH', 'eth', 100, { isNative: true, isMainstream: true }),
        ],
        chainGas: { eth: gas({ perLegGasUsd: 2, nativeBalanceUsd: 100 }) },
      }),
    );
    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0]).toMatchObject({
      kind: 'swap',
      amountUsd: 50,
      gasPayer: 'native',
    });
    expect(plan.spendableTotalUsd).toBe(98);
    expect(plan.shortfallUsd).toBe(0);
  });

  it('best-fit picks the smallest covering source, long-tail first', () => {
    const plan = planBuy(
      input({
        amountUsd: 50,
        memes: [PEPE],
        sources: [
          asset('USDT', 'eth', 300),
          asset('USDC', 'eth', 55),
          asset('LINK', 'eth', 60),
        ],
        chainGas: { eth: gas() },
      }),
    );
    expect(plan.legs.map(l => l.pay.symbol)).toEqual(['LINK']);
  });

  it('cross-chain avoids mainnet and prefers mainstream', () => {
    const plan = planBuy(
      input({
        amountUsd: 40,
        memes: [BONK],
        sources: [
          asset('USDT', 'eth', 100),
          asset('AERO', 'base', 100),
          asset('USDC', 'base', 100),
        ],
        chainGas: { eth: gas(), base: gas() },
      }),
    );
    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0]).toMatchObject({ kind: 'bridge' });
    expect(plan.legs[0].pay.symbol).toBe('USDC');
  });

  it('counts sources on non-bridge chains as unusable for cross-chain', () => {
    const plan = planBuy(
      input({
        amountUsd: 40,
        memes: [BONK],
        sources: [asset('USDC', 'zk', 100)],
        chainGas: { zk: gas({ bridgeSupported: false }) },
      }),
    );
    expect(plan.legs).toEqual([]);
    expect(plan.shortfallUsd).toBe(40);
  });

  it('falls back to Gas Deposit when the selected native token cannot cover gas', () => {
    const plan = planBuy(
      input({
        amountUsd: 50,
        memes: [PEPE],
        sources: [
          asset('ETH', 'eth', 1, { isNative: true, isMainstream: true }),
          asset('USDT', 'eth', 100),
        ],
        chainGas: { eth: gas({ perLegGasUsd: 2, nativeBalanceUsd: 1 }) },
        gasAccountBalanceUsd: 10,
      }),
    );
    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0]).toMatchObject({ gasPayer: 'gasAccount' });
    expect(plan.legs[0].pay.symbol).toBe('USDT');
  });

  it('marks legs as risk once the shared Gas Deposit budget is used up', () => {
    const plan = planBuy(
      input({
        amountUsd: 100,
        memes: [PEPE, meme('DEGEN', 'base', 600_000_000)],
        sources: [asset('USDT', 'eth', 100), asset('USDC', 'base', 100)],
        chainGas: {
          eth: gas({ perLegGasUsd: 2, nativeBalanceUsd: 0 }),
          base: gas({ perLegGasUsd: 3, nativeBalanceUsd: 0 }),
        },
        gasAccountBalanceUsd: 4,
      }),
    );
    const payerByChain = Object.fromEntries(
      plan.legs.map(l => [l.pay.chain, l.gasPayer]),
    );
    expect(payerByChain).toEqual({ base: 'gasAccount', eth: 'risk' });
  });

  it('reserves gas for a chain that is only used in the second pass', () => {
    const plan = planBuy(
      input({
        amountUsd: 85,
        memes: [meme('PEPE', 'eth', 100), meme('WOJAK', 'eth', 100)],
        sources: [
          asset('ETH', 'eth', 100, { isNative: true, isMainstream: true }),
          asset('USDC', 'base', 100),
        ],
        chainGas: {
          eth: gas({ perLegGasUsd: 10, nativeBalanceUsd: 100 }),
          base: gas({ perLegGasUsd: 5, nativeBalanceUsd: 0 }),
        },
        gasAccountBalanceUsd: 0,
      }),
    );
    const bridgeLeg = plan.legs.find(l => l.kind === 'bridge');
    expect(bridgeLeg).toMatchObject({ gasPayer: 'risk' });
  });

  it('reports shortfall when the selected sources are not enough', () => {
    const plan = planBuy(
      input({
        memes: [PEPE],
        sources: [asset('USDT', 'eth', 30)],
        chainGas: { eth: gas() },
      }),
    );
    expect(plan.shortfallUsd).toBeCloseTo(70);
  });

  it('matches the spec §4.5 example, including two-pass gas reserve and amount ordering', () => {
    const plan = planBuy(
      input({
        amountUsd: 100,
        memes: [PEPE, BONK],
        sources: [
          asset('ETH', 'eth', 50, { isNative: true, isMainstream: true }),
          asset('USDT', 'eth', 30),
          asset('USDC', 'base', 80),
          asset('BNB', 'bsc', 18, { isNative: true, isMainstream: true }),
        ],
        chainGas: {
          eth: gas({ perLegGasUsd: 2, nativeBalanceUsd: 50 }),
          bsc: gas({ perLegGasUsd: 0.1, nativeBalanceUsd: 18 }),
          base: gas({ perLegGasUsd: 0.05, nativeBalanceUsd: 5 }),
        },
      }),
    );
    expect(
      plan.legs.map(l => `${l.kind}:${l.pay.symbol}->${l.receive.symbol}`),
    ).toEqual([
      'swap:ETH->PEPE',
      'bridge:USDC->BONK',
      'swap:BNB->BONK',
      'swap:USDT->PEPE',
    ]);
    expect(plan.legs.map(l => l.amountUsd)).toEqual([
      expect.closeTo(46),
      expect.closeTo(22.1),
      expect.closeTo(17.9),
      expect.closeTo(14),
    ]);
    expect(plan.legs.every(l => l.gasPayer === 'native')).toBe(true);
    expect(plan.shortfallUsd).toBe(0);
  });
});
