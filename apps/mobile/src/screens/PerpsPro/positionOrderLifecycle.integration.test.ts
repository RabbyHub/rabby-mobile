import type { AssetPosition, OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
  __esModule: true,
  default: class IntegrationTestBleTransport {},
}));

import type { Account } from '@/core/startupServices/preference';
import type { CancelOrdersDependencies } from '@/hooks/perps/actions/cancelOrders';
import type { ClosePositionDependencies } from '@/hooks/perps/actions/closePosition';
import type { UpdateLeverageDependencies } from '@/hooks/perps/actions/updateLeverage';
import type { PositionTpSlDependencies } from '@/hooks/perps/actions/positionTpSl';

import {
  buildPerpsOpenOrders,
  getPerpsOpenOrderCounts,
} from './model/openOrder';
import { buildPerpsPositions } from './model/position';
import { buildPositionTpSlSummary } from './model/positionTpSl';

let buildPerpsCancelOrdersCommand: typeof import('@/hooks/perps/actions/cancelOrders').buildPerpsCancelOrdersCommand;
let executePerpsCancelOrders: typeof import('@/hooks/perps/actions/cancelOrders').executePerpsCancelOrders;
let buildPerpsClosePositionCommand: typeof import('@/hooks/perps/actions/closePosition').buildPerpsClosePositionCommand;
let executePerpsClosePosition: typeof import('@/hooks/perps/actions/closePosition').executePerpsClosePosition;
let buildPerpsUpdateLeverageCommand: typeof import('@/hooks/perps/actions/updateLeverage').buildPerpsUpdateLeverageCommand;
let executePerpsUpdateLeverage: typeof import('@/hooks/perps/actions/updateLeverage').executePerpsUpdateLeverage;
let buildPerpsPositionTpSlCommand: typeof import('@/hooks/perps/actions/positionTpSl').buildPerpsPositionTpSlCommand;
let executePerpsPositionTpSl: typeof import('@/hooks/perps/actions/positionTpSl').executePerpsPositionTpSl;

const account = {
  address: '0x0000000000000000000000000000000000000547',
  brandName: 'Rabby',
  type: 'PrivateKey',
} as Account;

const makePosition = (
  overrides: Partial<AssetPosition['position']> = {},
): AssetPosition =>
  ({
    position: {
      coin: 'BTC',
      cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
      entryPx: '60000',
      leverage: { type: 'cross', value: 10 },
      liquidationPx: '50000',
      marginUsed: '150',
      maxLeverage: 50,
      positionValue: '1500',
      returnOnEquity: '0.1',
      szi: '0.025',
      unrealizedPnl: '15',
      ...overrides,
    },
    type: 'oneWay',
  } as AssetPosition);

const makeOrder = (overrides: Partial<OpenOrder> = {}): OpenOrder => ({
  coin: 'BTC',
  isPositionTpsl: false,
  isTrigger: false,
  limitPx: '61000',
  oid: 1,
  orderType: 'Limit',
  origSz: '0.01',
  reduceOnly: false,
  side: 'B',
  sz: '0.01',
  tif: 'Gtc',
  timestamp: 100,
  triggerCondition: '',
  triggerPx: '0',
  ...overrides,
});

describe('Perps Pro position and order lifecycle integration', () => {
  beforeAll(async () => {
    jest.useFakeTimers();
    try {
      const [cancelOrders, closePosition, updateLeverage, positionTpSl] =
        await Promise.all([
          import('@/hooks/perps/actions/cancelOrders'),
          import('@/hooks/perps/actions/closePosition'),
          import('@/hooks/perps/actions/updateLeverage'),
          import('@/hooks/perps/actions/positionTpSl'),
        ]);
      buildPerpsCancelOrdersCommand =
        cancelOrders.buildPerpsCancelOrdersCommand;
      executePerpsCancelOrders = cancelOrders.executePerpsCancelOrders;
      buildPerpsClosePositionCommand =
        closePosition.buildPerpsClosePositionCommand;
      executePerpsClosePosition = closePosition.executePerpsClosePosition;
      buildPerpsUpdateLeverageCommand =
        updateLeverage.buildPerpsUpdateLeverageCommand;
      executePerpsUpdateLeverage = updateLeverage.executePerpsUpdateLeverage;
      buildPerpsPositionTpSlCommand =
        positionTpSl.buildPerpsPositionTpSlCommand;
      executePerpsPositionTpSl = positionTpSl.executePerpsPositionTpSl;
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it.each([
    {
      direction: 'long' as const,
      expectedIsBuy: false,
      orderType: 'market' as const,
      signedSize: '0.025',
    },
    {
      direction: 'short' as const,
      expectedIsBuy: true,
      orderType: 'limit' as const,
      signedSize: '-0.025',
    },
  ])(
    'projects a $direction position through a $orderType close and its refreshed UI state',
    async ({ expectedIsBuy, orderType, signedSize }) => {
      let sourcePositions = [makePosition({ szi: signedSize })];
      let sourceOrders: OpenOrder[] = [];
      const [position] = buildPerpsPositions(sourcePositions, sourceOrders);
      const submitted = jest.fn(async () =>
        orderType === 'market'
          ? {
              status: 'ok',
              response: { data: { statuses: [{ filled: { oid: 71 } }] } },
            }
          : {
              status: 'ok',
              response: { data: { statuses: [{ resting: { oid: 72 } }] } },
            },
      );
      const command = buildPerpsClosePositionCommand({
        account,
        coin: position!.coin,
        direction: position!.direction,
        expectedPositionSize: position!.baseSize,
        limitPrice: orderType === 'limit' ? '60500' : null,
        midPrice: '60000',
        orderType,
        pxDecimals: 2,
        size: position!.baseSize,
        szDecimals: 5,
      });
      const dependencies: ClosePositionDependencies = {
        getCurrentAccount: () => account,
        getLiveMidPrice: () => '60100',
        getLiveSignedSize: () => sourcePositions[0]?.position.szi ?? null,
        limitClose: submitted,
        marketClose: submitted,
        refreshClearinghouse: async () => {
          sourcePositions = [];
        },
        refreshOpenOrders: async () => {
          sourceOrders = [
            makeOrder({
              oid: 72,
              reduceOnly: true,
              side: expectedIsBuy ? 'B' : 'A',
            }),
          ];
        },
        resolveDex: () => '',
      };

      const result = await executePerpsClosePosition(command, dependencies);

      expect(submitted).toHaveBeenCalledWith(
        expect.objectContaining({
          isBuy: expectedIsBuy,
          reduceOnly: true,
          size: '0.025',
        }),
      );
      if (orderType === 'market') {
        expect(result).toMatchObject({ kind: 'filled', oid: 71 });
        expect(buildPerpsPositions(sourcePositions, sourceOrders)).toEqual([]);
      } else {
        expect(result).toMatchObject({ kind: 'resting', oid: 72 });
        expect(buildPerpsOpenOrders(sourceOrders)).toEqual([
          expect.objectContaining({
            oid: 72,
            reduceOnly: true,
          }),
        ]);
      }
    },
  );

  it('converges a leverage command back into the position projection', async () => {
    let sourcePosition = makePosition();
    const [before] = buildPerpsPositions([sourcePosition], []);
    const command = buildPerpsUpdateLeverageCommand({
      account,
      coin: before!.coin,
      isCross: false,
      leverage: 20,
      maxLeverage: before!.maxLeverage,
    });
    const updateLeverage = jest.fn(async () => ({ status: 'ok' }));
    const dependencies: UpdateLeverageDependencies = {
      getCurrentAccount: () => account,
      refresh: async () => {
        sourcePosition = makePosition({
          leverage: { type: 'isolated', value: 20 },
        });
      },
      resolveDex: () => '',
      updateLeverage,
    };

    await expect(
      executePerpsUpdateLeverage(command, dependencies),
    ).resolves.toEqual({ kind: 'success', refreshError: undefined });
    expect(updateLeverage).toHaveBeenCalledWith({
      coin: 'BTC',
      isCross: false,
      leverage: 20,
    });
    expect(buildPerpsPositions([sourcePosition], [])[0]).toMatchObject({
      coin: 'BTC',
      leverage: 20,
      marginMode: 'isolated',
    });
  });

  it('keeps partial cancellation explicit and refreshes only successful orders', async () => {
    let sourceOrders = [
      makeOrder({ coin: 'BTC', oid: 11, timestamp: 200 }),
      makeOrder({ coin: 'xyz:ETH', oid: 12, timestamp: 100 }),
    ];
    const before = buildPerpsOpenOrders(sourceOrders);
    const command = buildPerpsCancelOrdersCommand(
      account,
      before.map(order => ({ coin: order.coin, oid: order.oid })),
    );
    const dependencies: CancelOrdersDependencies = {
      cancelOrders: async () => ({
        response: {
          data: {
            statuses: ['success', { error: 'Already canceled' }],
          },
        },
      }),
      getCurrentAccount: () => account,
      refreshDexes: async dexes => {
        expect(dexes).toEqual(['']);
        sourceOrders = sourceOrders.filter(order => order.oid !== 11);
      },
      resolveDex: coin => (coin.includes(':') ? coin.split(':')[0]! : ''),
    };

    const result = await executePerpsCancelOrders(command, dependencies);
    const after = buildPerpsOpenOrders(sourceOrders);

    expect(result).toMatchObject({
      items: [
        { oid: 11, status: 'success' },
        { error: 'Already canceled', oid: 12, status: 'failed' },
      ],
      kind: 'partial',
    });
    expect(after.map(order => order.oid)).toEqual([12]);
    expect(getPerpsOpenOrderCounts(after)).toEqual({
      basic: 1,
      conditional: 0,
      unsupported: 0,
    });
  });

  it('projects one resting order through partial fills without changing its UI identity', () => {
    const snapshots: OpenOrder[][] = [
      [makeOrder({ oid: 21, origSz: '5', sz: '5' })],
      [makeOrder({ oid: 21, origSz: '5', sz: '3' })],
      [makeOrder({ oid: 21, origSz: '5', sz: '1' })],
      [],
    ];

    const projected = snapshots.map(buildPerpsOpenOrders);

    expect(projected.slice(0, 3).map(orders => orders.length)).toEqual([
      1, 1, 1,
    ]);
    expect(projected.slice(0, 3).map(orders => orders[0]?.key)).toEqual([
      'basic:BTC:21',
      'basic:BTC:21',
      'basic:BTC:21',
    ]);
    expect(
      projected.slice(0, 3).map(orders => ({
        filledRatio: orders[0]?.filledRatio,
        filledSize: orders[0]?.filledSize,
        remainingSize: orders[0]?.remainingSize,
      })),
    ).toEqual([
      { filledRatio: '0', filledSize: '0', remainingSize: '5' },
      { filledRatio: '0.4', filledSize: '2', remainingSize: '3' },
      { filledRatio: '0.8', filledSize: '4', remainingSize: '1' },
    ]);
    expect(projected[3]).toEqual([]);
  });

  it('converges a strict cancel-then-create partial TP replacement into the Position projection', async () => {
    const sourcePositions = [makePosition()];
    let sourceOrders = [
      makeOrder({
        isTrigger: true,
        oid: 7,
        orderType: 'Take Profit Market',
        reduceOnly: true,
        side: 'A',
        sz: '0.01',
        triggerCondition: 'Price above 61000',
        triggerPx: '61000',
      }),
    ];
    const before = buildPerpsPositions(sourcePositions, sourceOrders)[0]!;
    expect(
      buildPositionTpSlSummary(before.tpslOrders, '60000').partialCount,
    ).toBe(1);
    const command = buildPerpsPositionTpSlCommand({
      account,
      coin: 'BTC',
      direction: 'long',
      expectedPositionSize: before.baseSize,
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: 7,
          size: '0.01',
          triggerPrice: '62000',
        },
      ],
      markPrice: '60000',
      pxDecimals: 2,
      scope: 'partial',
      szDecimals: 5,
    });
    const calls: string[] = [];
    const dependencies: PositionTpSlDependencies = {
      cancelOrder: async (_coin, oid) => {
        calls.push(`cancel:${oid}`);
        sourceOrders = sourceOrders.filter(order => order.oid !== oid);
        return { response: { data: { statuses: ['success'] } }, status: 'ok' };
      },
      getCurrentAccount: () => account,
      getLiveMark: () => '60000',
      getLiveOpenOrders: () => sourceOrders,
      getLiveSignedSize: () => sourcePositions[0]!.position.szi,
      placePartial: async params => {
        calls.push(`create:${params.triggerPx}:${params.slippage}`);
        sourceOrders.push(
          makeOrder({
            isTrigger: true,
            oid: 8,
            orderType: 'Take Profit Market',
            reduceOnly: true,
            side: 'A',
            sz: params.size,
            triggerCondition: `Price above ${params.triggerPx}`,
            triggerPx: params.triggerPx,
          }),
        );
        return {
          response: { data: { statuses: [{ resting: { oid: 8 } }] } },
          status: 'ok',
        };
      },
      placePosition: jest.fn(),
      refresh: jest.fn(),
      resolveDex: () => '',
    };

    await expect(
      executePerpsPositionTpSl(command, dependencies),
    ).resolves.toMatchObject({ kind: 'success' });
    expect(calls).toEqual(['cancel:7', 'create:62000:0.08']);
    const after = buildPerpsPositions(sourcePositions, sourceOrders)[0]!;
    expect(
      buildPositionTpSlSummary(after.tpslOrders, '60000').takeProfit
        .nearestPartialOrder,
    ).toMatchObject({ oid: 8, triggerPrice: '62000' });
  });

  it('moves a reverse-opening child from dormant Open Orders to the matching net position only', () => {
    const child = makeOrder({
      isTrigger: true,
      oid: 22,
      orderType: 'Take Profit Market',
      origSz: '0.04',
      reduceOnly: true,
      side: 'B',
      sz: '0.04',
      triggerCondition: 'Price below 59000',
      triggerPx: '59000',
    });
    const dormantSnapshot = [
      makeOrder({
        children: [child],
        oid: 21,
        origSz: '0.04',
        side: 'A',
        sz: '0.04',
      }),
    ];

    expect(buildPerpsOpenOrders(dormantSnapshot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isTopLevel: false, oid: 22 }),
      ]),
    );
    expect(
      buildPerpsPositions([makePosition({ szi: '0.025' })], dormantSnapshot)[0]
        ?.tpslOrders,
    ).toEqual([]);

    const activeSnapshot = [child];
    expect(buildPerpsOpenOrders(activeSnapshot)).toEqual([
      expect.objectContaining({ isTopLevel: true, oid: 22 }),
    ]);
    expect(
      buildPerpsPositions([makePosition({ szi: '0.01' })], activeSnapshot)[0]
        ?.tpslOrders,
    ).toEqual([]);
    expect(buildPerpsPositions([], activeSnapshot)).toEqual([]);
    expect(
      buildPerpsPositions([makePosition({ szi: '-0.015' })], activeSnapshot)[0]
        ?.tpslOrders,
    ).toEqual([expect.objectContaining({ oid: 22, scope: 'partial' })]);
    expect(
      buildPerpsPositions([makePosition({ szi: '0.02' })], activeSnapshot)[0]
        ?.tpslOrders,
    ).toEqual([]);
  });
});
