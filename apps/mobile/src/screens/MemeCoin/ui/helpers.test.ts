import type { MemeHolding } from '../data/types';
import { tokenKey } from '../engine/keys';
import type { PlanResult, PlannedLeg } from '../engine/types';
import {
  canConfirmBuy,
  formatMarketCapUsd,
  getBuySummary,
  getExecuteButtonState,
  parseBuyAmount,
  pickTokenLogos,
  toSellHoldings,
} from './helpers';

const leg: PlannedLeg = {
  key: 'base:0xusdc->base:0xpepe',
  kind: 'swap',
  pay: { id: '0xusdc', chain: 'base', symbol: 'USDC' },
  receive: { id: '0xpepe', chain: 'base', symbol: 'PEPE' },
  amountUsd: 100,
  gasPayer: 'native',
};

const plan = (over: Partial<PlanResult> = {}): PlanResult => ({
  legs: [leg],
  paymentBySource: {},
  spendableTotalUsd: 0,
  shortfallUsd: 0,
  ...over,
});

describe('parseBuyAmount', () => {
  it.each([
    ['100', 100],
    ['100.00', 100],
    ['12.5', 12.5],
    ['12,34', 12.34],
    ['.5', 0.5],
    ['7.', 7],
    [' 8 ', 8],
  ])('parses %p', (text, expected) => {
    expect(parseBuyAmount(text)).toBe(expected);
  });

  it.each(['', '0', '0.00', '1.234', 'abc', '1,2,3', '-5', '1e3'])(
    'rejects %p',
    text => {
      expect(parseBuyAmount(text)).toBeNull();
    },
  );
});

describe('formatMarketCapUsd', () => {
  it('shows whole dollars with separators and no K/M/B suffix', () => {
    expect(formatMarketCapUsd(132262615.4)).toBe('$132,262,615');
    expect(formatMarketCapUsd(2500000000)).toBe('$2,500,000,000');
    expect(formatMarketCapUsd(36805.5)).toBe('$36,806');
    expect(formatMarketCapUsd(0)).toBe('$0');
  });
});

describe('getBuySummary', () => {
  it('asks for the whole amount when nothing is selected', () => {
    expect(
      getBuySummary({ amountUsd: 100, selectedCount: 0, plan: plan() }),
    ).toEqual({ kind: 'none', neededUsd: 100 });
  });

  it('reports the shortfall', () => {
    expect(
      getBuySummary({
        amountUsd: 100,
        selectedCount: 2,
        plan: plan({ shortfallUsd: 20 }),
      }),
    ).toEqual({ kind: 'short', shortfallUsd: 20 });
  });

  it('sums the estimated payment when fully covered, ignoring float noise', () => {
    expect(
      getBuySummary({
        amountUsd: 100,
        selectedCount: 2,
        plan: plan({
          shortfallUsd: 1e-12,
          paymentBySource: { a: 60, b: 40 },
        }),
      }),
    ).toEqual({ kind: 'enough', totalPaymentUsd: 100 });
  });
});

describe('canConfirmBuy', () => {
  it('needs ready data, a valid amount, legs and no shortfall', () => {
    expect(canConfirmBuy({ ready: true, amountUsd: 100, plan: plan() })).toBe(
      true,
    );
    expect(canConfirmBuy({ ready: false, amountUsd: 100, plan: plan() })).toBe(
      false,
    );
    expect(canConfirmBuy({ ready: true, amountUsd: null, plan: plan() })).toBe(
      false,
    );
    expect(
      canConfirmBuy({ ready: true, amountUsd: 100, plan: plan({ legs: [] }) }),
    ).toBe(false);
    expect(
      canConfirmBuy({
        ready: true,
        amountUsd: 100,
        plan: plan({ shortfallUsd: 5 }),
      }),
    ).toBe(false);
  });
});

describe('getExecuteButtonState', () => {
  it('maps the task status', () => {
    expect(getExecuteButtonState('idle', 0, 3)).toEqual({ kind: 'start' });
    expect(getExecuteButtonState('running', 1, 3)).toEqual({
      kind: 'executing',
      done: 1,
      total: 3,
    });
    expect(getExecuteButtonState('finished', 3, 3)).toEqual({ kind: 'done' });
  });
});

describe('toSellHoldings', () => {
  const holding = (
    id: string,
    chain: string,
    valueUsd: number,
  ): MemeHolding => ({
    meme: {
      id,
      chain,
      symbol: id.toUpperCase(),
      logoUrl: 'logo',
      price: 1,
      change24h: 0,
    },
    amount: 1,
    valueUsd,
    pnl: null,
  });

  it('pairs each meme with its chain native token and drops unknown chains', () => {
    const getNative = (chain: string) =>
      chain === 'bsc'
        ? { id: 'bsc', chain: 'bsc', symbol: 'BNB', logoUrl: 'bnb' }
        : null;

    expect(
      toSellHoldings(
        [holding('pepe', 'bsc', 30), holding('x', 'unknown', 5)],
        getNative,
      ),
    ).toEqual([
      {
        meme: { id: 'pepe', chain: 'bsc', symbol: 'PEPE' },
        valueUsd: 30,
        nativeToken: { id: 'bsc', chain: 'bsc', symbol: 'BNB' },
      },
    ]);
  });
});

describe('pickTokenLogos', () => {
  it('keeps logos of the given tokens by token key', () => {
    const logos = new Map([
      [tokenKey({ chain: 'base', id: '0xUSDC' }), 'usdc.png'],
      [tokenKey({ chain: 'base', id: '0xother' }), 'other.png'],
    ]);
    expect(
      pickTokenLogos(
        [
          { chain: 'base', id: '0xusdc' },
          { chain: 'base', id: '0xnone' },
        ],
        logos,
      ),
    ).toEqual({ 'base:0xusdc': 'usdc.png' });
  });
});
