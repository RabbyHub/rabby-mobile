// perps.ts pulls the SDK singleton and services barrel at module level —
// irrelevant to the pure helpers under test.
jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/core/services', () => ({ perpsService: {} }));

import type { Meta } from '@rabby-wallet/hyperliquid-sdk';
import type { PerpTopTokenV3 } from '@rabby-wallet/rabby-api/dist/types';

import { formatMarkData, getPxDecimals } from './perps';

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

describe('formatMarkData maintenance rules', () => {
  it.each([
    ['normal', false],
    ['noCross', true],
    ['strictIsolated', true],
  ] as const)(
    'normalizes metadata marginMode=%s before the legacy flag',
    (marginMode, onlyIsolated) => {
      const meta: Meta = {
        collateralToken: 0,
        marginTables: [],
        universe: [
          {
            marginMode,
            maxLeverage: 10,
            name: 'TEST',
            onlyIsolated: !onlyIsolated,
            szDecimals: 2,
          },
        ],
      };
      const topAsset = {
        brief: 'Test Market',
        dex_id: '',
        display_name: 'TEST/USDC',
        name: 'TEST',
        token_id: 0,
      } as unknown as PerpTopTokenV3;

      expect(formatMarkData([meta], [topAsset], { 0: '' })[0]).toMatchObject({
        brief: 'Test Market',
        marginMode,
        onlyIsolated,
      });
    },
  );

  it('fails closed for legacy onlyIsolated when marginMode is missing', () => {
    const meta: Meta = {
      collateralToken: 0,
      marginTables: [],
      universe: [
        {
          maxLeverage: 10,
          name: 'LEGACY',
          onlyIsolated: true,
          szDecimals: 2,
        },
      ],
    };
    const topAsset = {
      dex_id: '',
      display_name: 'LEGACY/USDC',
      name: 'LEGACY',
      token_id: 0,
    } as unknown as PerpTopTokenV3;

    expect(formatMarkData([meta], [topAsset], { 0: '' })[0]).toMatchObject({
      marginMode: 'strictIsolated',
      onlyIsolated: true,
    });
  });

  it('links each market to its complete normalized margin table', () => {
    const meta: Meta = {
      collateralToken: 0,
      marginTables: [
        [
          51,
          {
            description: 'tiered 10x',
            marginTiers: [
              { lowerBound: '0', maxLeverage: 10 },
              { lowerBound: '3000000', maxLeverage: 5 },
            ],
          },
        ],
      ],
      universe: [
        {
          marginTableId: 51,
          maxLeverage: 10,
          name: 'BTC',
          szDecimals: 5,
        },
      ],
    };
    const topAsset = {
      category: '',
      category_id: '',
      dex_id: '',
      display_name: 'BTC/USDC',
      full_logo_url: '',
      name: 'BTC',
      token_id: 0,
    } as unknown as PerpTopTokenV3;

    expect(formatMarkData([meta], [topAsset], { 0: '' })[0]).toMatchObject({
      maintenanceMarginTiers: [
        {
          lowerBound: '0',
          maintenanceDeduction: '0',
          maintenanceMarginRate: '0.05',
          maxLeverage: 10,
        },
        {
          lowerBound: '3000000',
          maintenanceDeduction: '150000',
          maintenanceMarginRate: '0.1',
          maxLeverage: 5,
        },
      ],
    });
    expect(
      formatMarkData([{ ...meta, marginTables: [] }], [topAsset], { 0: '' })[0],
    ).toMatchObject({ maintenanceMarginTiers: [] });
  });

  it('materializes protocol-defined implicit tables below ID 50 and fails closed on inconsistent metadata', () => {
    const topAsset = {
      category: '',
      category_id: '',
      dex_id: '',
      display_name: 'CL/USDC',
      full_logo_url: '',
      name: 'xyz:CL',
      token_id: 0,
    } as unknown as PerpTopTokenV3;
    const implicitMeta: Meta = {
      collateralToken: 0,
      marginTables: [],
      universe: [
        {
          marginTableId: 20,
          maxLeverage: 20,
          name: 'xyz:CL',
          szDecimals: 2,
        },
      ],
    };

    expect(
      formatMarkData([implicitMeta], [topAsset], { 0: '' })[0],
    ).toMatchObject({
      maintenanceMarginTiers: [
        {
          lowerBound: '0',
          maintenanceDeduction: '0',
          maintenanceMarginRate: '0.025',
          maxLeverage: 20,
        },
      ],
    });
    expect(
      formatMarkData(
        [
          {
            ...implicitMeta,
            universe: [
              {
                ...implicitMeta.universe[0],
                maxLeverage: 10,
              },
            ],
          },
        ],
        [topAsset],
        { 0: '' },
      )[0],
    ).toMatchObject({ maintenanceMarginTiers: [] });
  });

  it('keeps an explicit table authoritative even when its ID is below 50', () => {
    const meta: Meta = {
      collateralToken: 0,
      marginTables: [
        [
          20,
          {
            description: 'explicit 5x',
            marginTiers: [{ lowerBound: '0', maxLeverage: 5 }],
          },
        ],
      ],
      universe: [
        {
          marginTableId: 20,
          maxLeverage: 20,
          name: 'xyz:CL',
          szDecimals: 2,
        },
      ],
    };
    const topAsset = {
      category: '',
      category_id: '',
      dex_id: '',
      display_name: 'CL/USDC',
      full_logo_url: '',
      name: 'xyz:CL',
      token_id: 0,
    } as unknown as PerpTopTokenV3;

    expect(formatMarkData([meta], [topAsset], { 0: '' })[0]).toMatchObject({
      maintenanceMarginTiers: [
        {
          maintenanceMarginRate: '0.1',
          maxLeverage: 5,
        },
      ],
    });
  });
});

describe('formatMarkData market identity', () => {
  const createMeta = (name: string, index: number): Meta => {
    const universe: Meta['universe'] = [];
    universe[index] = {
      maxLeverage: 3,
      name,
      szDecimals: 2,
    };
    return {
      collateralToken: 0,
      marginTables: [],
      universe,
    };
  };

  const koruAsset = {
    brief: 'Direxion Daily MSCI South Korea Bull 3X Shares',
    category: 'Stocks',
    category_id: 'stocks',
    dex_id: 'xyz',
    display_name: 'KORU',
    full_logo_url: 'https://example.test/koru.png',
    name: 'xyz:KORU',
    token_id: 103,
  } as unknown as PerpTopTokenV3;

  it('maps an SDK-known xyz market and preserves its display metadata', () => {
    const nativeMeta = createMeta('BTC', 0);
    const xyzMeta = createMeta('xyz:KORU', 103);

    expect(
      formatMarkData([nativeMeta, xyzMeta], [koruAsset], {
        0: '',
        1: 'xyz',
      }),
    ).toEqual([
      expect.objectContaining({
        brief: 'Direxion Daily MSCI South Korea Bull 3X Shares',
        category: 'Stocks',
        categoryId: 'stocks',
        dexId: 'xyz',
        displayName: 'KORU',
        index: 103,
        name: 'xyz:KORU',
        quoteAsset: 'USDC',
      }),
    ]);
  });

  it('does not project a non-native market through the native dex metadata', () => {
    expect(
      formatMarkData([createMeta('xyz:KORU', 103)], [koruAsset], { 0: '' }),
    ).toEqual([]);
  });

  it('rejects a stale token index whose canonical SDK coin changed', () => {
    expect(
      formatMarkData([createMeta('xyz:OTHER', 103)], [koruAsset], {
        0: 'xyz',
      }),
    ).toEqual([]);
  });
});
