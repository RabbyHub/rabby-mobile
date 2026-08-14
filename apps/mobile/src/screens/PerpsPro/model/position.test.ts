import type { AssetPosition, OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { buildPerpsMaintenanceMarginTiers } from '@/utils/perpsMargin';

import {
  buildPerpsPositions,
  calculateSignedLiquidationDistance,
  collectPositionTpslOrders,
  filterPerpsPositionsForMarket,
  getPerpsPositionDisplaySize,
} from './position';

const makeOrder = (overrides: Partial<OpenOrder>): OpenOrder => ({
  coin: 'BTC',
  isPositionTpsl: true,
  isTrigger: true,
  limitPx: '0',
  oid: 1,
  orderType: 'Take Profit Market',
  origSz: '1',
  reduceOnly: true,
  side: 'A',
  sz: '1',
  tif: null,
  timestamp: 1,
  triggerCondition: 'Price above 70000',
  triggerPx: '70000',
  ...overrides,
});

const makePosition = (overrides: Partial<AssetPosition['position']>) =>
  ({
    position: {
      coin: 'BTC',
      cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
      entryPx: '60000',
      leverage: { type: 'cross', value: 40 },
      liquidationPx: '50000',
      marginUsed: '25',
      maxLeverage: 50,
      positionValue: '1000',
      returnOnEquity: '-0.12',
      szi: '0.02',
      unrealizedPnl: '10',
      ...overrides,
    },
    type: 'oneWay',
  } as AssetPosition);

describe('Perps Pro position model', () => {
  it('calculates signed liquidation distance from mark to liquidation price', () => {
    const long = calculateSignedLiquidationDistance({
      liquidationPrice: '63000',
      markPrice: '63812',
    });
    expect(long?.priceGap).toBe('-812');
    expect(Number(long?.ratio)).toBeCloseTo((63000 - 63812) / 63812, 12);

    expect(
      calculateSignedLiquidationDistance({
        liquidationPrice: '120',
        markPrice: '105',
      }),
    ).toEqual({ priceGap: '15', ratio: '0.14285714285714285714' });
    expect(
      calculateSignedLiquidationDistance({
        liquidationPrice: null,
        markPrice: '105',
      }),
    ).toBeNull();
  });

  it('derives direction, ROI, and isolated-only risk from position facts', () => {
    const maintenanceMarginTiersByCoin = {
      BTC: buildPerpsMaintenanceMarginTiers([
        { lowerBound: '0', maxLeverage: 50 },
      ]),
      ETH: buildPerpsMaintenanceMarginTiers([
        { lowerBound: '0', maxLeverage: 25 },
      ]),
    };
    const positions = buildPerpsPositions(
      [
        makePosition({
          coin: 'BTC',
          leverage: { type: 'isolated', value: 40 },
          returnOnEquity: '-0.12',
          szi: '0.02',
        }),
        makePosition({
          coin: 'ETH',
          leverage: { type: 'isolated', value: 20 },
          positionValue: '-400',
          returnOnEquity: '0.3',
          szi: '-2',
          unrealizedPnl: '-8',
        }),
        makePosition({
          coin: 'SOL',
          leverage: { type: 'cross', value: 10 },
        }),
      ],
      [],
      maintenanceMarginTiersByCoin,
    );

    expect(positions[0]).toMatchObject({
      baseSize: '0.02',
      direction: 'long',
      marginRatio: '0.4',
      quoteSize: '1000',
      roiRatio: '0.12',
    });
    expect(positions[1]).toMatchObject({
      baseSize: '2',
      direction: 'short',
      marginRatio: '0.32',
      quoteSize: '400',
      roiRatio: '-0.3',
    });
    expect(positions[2]).toMatchObject({
      coin: 'SOL',
      marginMode: 'cross',
      marginRatio: null,
    });
  });

  it('collects active position and fixed-size TP/SL but excludes nested pending children', () => {
    const orders = [
      makeOrder({ oid: 3, orderType: 'Stop Market', triggerPx: '50000' }),
      makeOrder({
        children: [
          makeOrder({ oid: 1, triggerPx: '70000' }),
          makeOrder({ oid: 2, triggerPx: '65000' }),
        ],
        isPositionTpsl: false,
        isTrigger: false,
        oid: 10,
        orderType: 'Limit',
        reduceOnly: false,
      }),
      makeOrder({ coin: 'ETH', oid: 4 }),
    ];

    expect(collectPositionTpslOrders('BTC', orders)).toEqual([
      expect.objectContaining({ kind: 'stopLoss', oid: 3, scope: 'position' }),
    ]);
  });

  it('sorts positions by canonical coin ascending like Rabby Desktop', () => {
    const positions = buildPerpsPositions(
      [
        makePosition({ coin: 'xyz:BTC' }),
        makePosition({ coin: 'ETH' }),
        makePosition({ coin: 'BTC' }),
      ],
      [],
    );

    expect(positions.map(position => position.coin)).toEqual([
      'BTC',
      'ETH',
      'xyz:BTC',
    ]);
  });

  it('keeps total count independent from display filtering and shares size unit', () => {
    const positions = buildPerpsPositions(
      [makePosition({ coin: 'BTC' }), makePosition({ coin: 'ETH' })],
      [],
    );

    expect(positions).toHaveLength(2);
    expect(filterPerpsPositionsForMarket(positions, 'BTC', true)).toHaveLength(
      1,
    );
    expect(filterPerpsPositionsForMarket(positions, 'BTC', false)).toHaveLength(
      2,
    );
    expect(getPerpsPositionDisplaySize(positions[0]!, 'base')).toBe('0.02');
    expect(getPerpsPositionDisplaySize(positions[0]!, 'quote')).toBe('1000');
  });
});
