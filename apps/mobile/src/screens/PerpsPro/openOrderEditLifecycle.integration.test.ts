import type { Account } from '@/core/startupServices/preference';
import type { PerpsModifyOpenOrderDependencies } from '@/hooks/perps/actions/modifyOpenOrder';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({
  __esModule: true,
  default: class IntegrationTestBleTransport {},
}));

import { buildPerpsOpenOrderViewModel } from './model/openOrder';

let buildPerpsModifyOpenOrderCommand: typeof import('@/hooks/perps/actions/modifyOpenOrder').buildPerpsModifyOpenOrderCommand;
let executePerpsModifyOpenOrder: typeof import('@/hooks/perps/actions/modifyOpenOrder').executePerpsModifyOpenOrder;

const account = {
  address: '0x0000000000000000000000000000000000000163',
  brandName: 'Rabby',
  type: 'PrivateKey',
} as Account;

const makeTriggerLimitOrder = (
  overrides: Partial<OpenOrder> = {},
): OpenOrder => ({
  cloid: null,
  coin: 'BTC',
  isPositionTpsl: false,
  isTrigger: true,
  limitPx: '105',
  oid: 163,
  orderType: 'Take Profit Limit',
  origSz: '0.5',
  reduceOnly: false,
  side: 'B',
  sz: '0.5',
  tif: null,
  timestamp: 1,
  triggerCondition: 'Above',
  triggerPx: '110',
  ...overrides,
});

describe('Perps Pro open order edit lifecycle integration', () => {
  beforeAll(async () => {
    jest.useFakeTimers();
    try {
      const action = await import('@/hooks/perps/actions/modifyOpenOrder');
      buildPerpsModifyOpenOrderCommand =
        action.buildPerpsModifyOpenOrderCommand;
      executePerpsModifyOpenOrder = action.executePerpsModifyOpenOrder;
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('projects an opening Conditional Limit through one direct modify', async () => {
    let liveOrder = makeTriggerLimitOrder();
    const before = buildPerpsOpenOrderViewModel(liveOrder);
    const modifyOrder = jest.fn(
      async (
        params: Parameters<PerpsModifyOpenOrderDependencies['modifyOrder']>[0],
      ) => {
        const trigger = params.orderType as {
          trigger: { triggerPx: string };
        };
        liveOrder = {
          ...liveOrder,
          limitPx: params.limitPx,
          sz: params.sz,
          triggerPx: trigger.trigger.triggerPx,
        };
        return { response: { type: 'default' }, status: 'ok' };
      },
    );
    const dependencies: PerpsModifyOpenOrderDependencies = {
      getCurrentAccount: () => account,
      getCurrentDex: () => '',
      getLiveOpenOrders: () => [liveOrder],
      getOrderStatus: async () => ({
        order: { order: liveOrder, status: 'open', statusTimestamp: 1 },
        status: 'order',
      }),
      hasPermission: () => true,
      modifyOrder,
      refreshClearinghouse: jest.fn(),
      refreshOpenOrders: jest.fn(),
    };

    expect(before.editKind).toBe('triggerLimit');
    const command = buildPerpsModifyOpenOrderCommand({
      account,
      baseSize: '0.4',
      cloid: before.cloid,
      coin: before.coin,
      dexId: '',
      editKind: 'triggerLimit',
      expectedIsPositionTpsl: before.isPositionTpsl,
      expectedLimitPrice: before.limitPrice!,
      expectedOrderType: before.orderType,
      expectedRemainingSize: before.remainingSize,
      expectedTriggerPrice: before.triggerPrice,
      limitPrice: '106',
      marketKey: 'hyperliquid::BTC',
      oid: before.oid,
      pxDecimals: 2,
      reduceOnly: before.reduceOnly,
      side: before.side,
      szDecimals: 3,
      triggerKind: before.triggerKind,
      triggerPrice: '112',
    });

    await expect(
      executePerpsModifyOpenOrder(command, dependencies),
    ).resolves.toEqual({ kind: 'updated', refreshError: undefined });
    expect(modifyOrder).toHaveBeenCalledTimes(1);
    expect(modifyOrder).toHaveBeenCalledWith({
      coin: 'BTC',
      isBuy: true,
      limitPx: '106',
      oid: 163,
      orderType: {
        trigger: { isMarket: false, tpsl: 'tp', triggerPx: '112' },
      },
      reduceOnly: false,
      sz: '0.4',
    });
    expect(buildPerpsOpenOrderViewModel(liveOrder)).toMatchObject({
      editKind: 'triggerLimit',
      limitPrice: '106',
      remainingSize: '0.4',
      triggerPrice: '112',
    });
  });
});
