// perps.ts pulls the SDK singleton and services barrel at module level —
// irrelevant to the pure helpers under test.
jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/core/services', () => ({ perpsService: {} }));

import { formatAllDexsClearinghouseState, getPxDecimals } from './perps';
import type { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';

const makeDexState = (
  crossAccountValue: string,
  crossTotalMarginUsed: string,
  time = 1,
): ClearinghouseState => ({
  assetPositions: [],
  crossMaintenanceMarginUsed: '0',
  crossMarginSummary: {
    accountValue: crossAccountValue,
    totalMarginUsed: crossTotalMarginUsed,
    totalNtlPos: '0',
    totalRawUsd: '0',
  },
  marginSummary: {
    accountValue: crossAccountValue,
    totalMarginUsed: crossTotalMarginUsed,
    totalNtlPos: '0',
    totalRawUsd: '0',
  },
  time,
  withdrawable: '0',
});

describe('formatAllDexsClearinghouseState — crossAvailableAllDexs', () => {
  it('exposes free cross margin (equity − initial margin) of a single dex', () => {
    // live-data replica: unified account maxed out at 20x — only dust is free
    const result = formatAllDexsClearinghouseState([
      ['', makeDexState('81.372299', '81.347258')],
    ]);
    expect(Number(result?.crossAvailableAllDexs)).toBeCloseTo(0.025041, 6);
  });

  it('sums across dexs, clamping each dex at 0 (independent collateral pools)', () => {
    const result = formatAllDexsClearinghouseState([
      ['', makeDexState('12.264989', '5.828955')],
      // a deficit on one dex must not offset availability on another
      ['xyz', makeDexState('3.0', '4.5')],
    ]);
    expect(Number(result?.crossAvailableAllDexs)).toBeCloseTo(6.436034, 6);
    // per-dex breakdown for per-coin attribution: deficit dexs are omitted
    expect(Number(result?.crossAvailableByDex?.[''])).toBeCloseTo(6.436034, 6);
    expect(result?.crossAvailableByDex).not.toHaveProperty('xyz');
  });

  it('is 0 when no funds are committed to cross', () => {
    const result = formatAllDexsClearinghouseState([
      ['', makeDexState('0.0', '0.0')],
    ]);
    expect(result?.crossAvailableAllDexs).toBe('0');
  });
});

describe('getPxDecimals', () => {
  // decimals = clamp(4 - floor(log10(0.95 * px)), 0, 6 - szDecimals)
  describe('5-significant-figures rule from the price magnitude', () => {
    it('BTC-like: szDecimals=5, px=64000 → whole numbers', () => {
      expect(getPxDecimals(5, 64000)).toBe(0);
    });

    it('sub-dollar price: szDecimals=0, px=0.12345 → 5 decimals', () => {
      expect(getPxDecimals(0, 0.12345)).toBe(5);
    });

    it('ETH-like: szDecimals=4, px=3500 → tick bound (2) beats sig-figs? no — sig-figs (1) is tighter', () => {
      expect(getPxDecimals(4, 3500)).toBe(1);
    });

    it('accepts a numeric string reference price', () => {
      expect(getPxDecimals(5, '64000')).toBe(0);
    });

    it('uses the magnitude of a negative price (defensive abs)', () => {
      expect(getPxDecimals(0, -0.12345)).toBe(5);
    });
  });

  describe('×0.95 hysteresis at magnitude boundaries', () => {
    it('keeps the finer precision just above a power of ten', () => {
      expect(getPxDecimals(0, 1.05)).toBe(5); // 0.95*1.05 < 1 → still 5 decimals
    });

    it('steps down once past the hysteresis band', () => {
      expect(getPxDecimals(0, 1.06)).toBe(4); // 0.95*1.06 > 1 → 4 decimals
    });
  });

  describe('clamping', () => {
    it('never returns negative decimals for very large prices', () => {
      expect(getPxDecimals(0, 1_000_000)).toBe(0);
    });

    it('caps tiny prices by the perp tick bound (6 - szDecimals)', () => {
      expect(getPxDecimals(0, 0.0001234)).toBe(6);
      expect(getPxDecimals(2, 0.0001234)).toBe(4);
    });

    it('szDecimals ≥ 6 pins the result to 0 regardless of price', () => {
      expect(getPxDecimals(7, 0.001)).toBe(0);
    });
  });

  describe('fallback to the tick bound without a usable reference price', () => {
    it.each([
      [5, undefined, 1],
      [0, undefined, 6],
      [0, '', 6], // Number('') === 0
      [0, 'abc', 6], // NaN
      [0, 0, 6],
    ] as const)('szDecimals=%p, refPx=%p → %p', (sz, px, expected) => {
      expect(getPxDecimals(sz, px)).toBe(expected);
    });

    it('coerces a runtime-undefined szDecimals to 0 (defensive ?? path)', () => {
      expect(getPxDecimals(undefined as unknown as number, 100)).toBe(3);
    });
  });
});
