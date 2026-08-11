import type { AssetPosition, OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
  __esModule: true,
  default: class IntegrationTestBleTransport {},
}));

import type { Account } from '@/core/startupServices/preference';
import type { CancelOrdersDependencies } from '@/hooks/perps/actions/cancelOrders';
import type { ClosePositionDependencies } from '@/hooks/perps/actions/closePosition';
import type { UpdateLeverageDependencies } from '@/hooks/perps/actions/updateLeverage';

import {
  buildPerpsOpenOrders,
  getPerpsOpenOrderCounts,
} from './model/openOrder';
import { buildPerpsPositions } from './model/position';

let buildPerpsCancelOrdersCommand: typeof import('@/hooks/perps/actions/cancelOrders').buildPerpsCancelOrdersCommand;
let executePerpsCancelOrders: typeof import('@/hooks/perps/actions/cancelOrders').executePerpsCancelOrders;
let buildPerpsClosePositionCommand: typeof import('@/hooks/perps/actions/closePosition').buildPerpsClosePositionCommand;
let executePerpsClosePosition: typeof import('@/hooks/perps/actions/closePosition').executePerpsClosePosition;
let buildPerpsUpdateLeverageCommand: typeof import('@/hooks/perps/actions/updateLeverage').buildPerpsUpdateLeverageCommand;
let executePerpsUpdateLeverage: typeof import('@/hooks/perps/actions/updateLeverage').executePerpsUpdateLeverage;

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
      const [cancelOrders, closePosition, updateLeverage] = await Promise.all([
        import('@/hooks/perps/actions/cancelOrders'),
        import('@/hooks/perps/actions/closePosition'),
        import('@/hooks/perps/actions/updateLeverage'),
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
});
