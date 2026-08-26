jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: jest.fn() },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  fetchPositionOpenOrdersHttp: jest.fn(),
  getDexByCoin: jest.fn(() => ''),
  perpsStore: { getState: jest.fn(() => ({ currentPerpsAccount: null })) },
}));

import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

import {
  buildPerpsModifyOpenOrderCommand,
  executePerpsModifyOpenOrder,
  type PerpsModifyOpenOrderDependencies,
} from './modifyOpenOrder';

const account = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'watch',
};

const liveOrder: OpenOrder = {
  coin: 'BTC',
  isPositionTpsl: false,
  isTrigger: false,
  limitPx: '50000',
  oid: 7,
  orderType: 'Limit',
  origSz: '0.01',
  reduceOnly: true,
  side: 'A',
  sz: '0.004',
  tif: 'Alo',
  timestamp: 1,
  triggerCondition: '',
  triggerPx: '0',
};

const command = () =>
  buildPerpsModifyOpenOrderCommand({
    account,
    baseSize: '0.003456',
    coin: 'BTC',
    dexId: '',
    expectedLimitPrice: '50000',
    expectedRemainingSize: '0.004',
    limitPrice: '51000.129',
    marketKey: 'hyperliquid::BTC',
    oid: 7,
    pxDecimals: 2,
    reduceOnly: true,
    side: 'sell',
    szDecimals: 5,
    tif: 'Alo',
  });

const triggerMarketOrder: OpenOrder = {
  ...liveOrder,
  isTrigger: true,
  limitPx: '101.2',
  oid: 9,
  orderType: 'Take Profit Market',
  reduceOnly: false,
  side: 'B',
  sz: '0.4',
  tif: null,
  triggerCondition: 'Above 110',
  triggerPx: '110',
};

const triggerCommand = () =>
  buildPerpsModifyOpenOrderCommand({
    account,
    baseSize: '0.5',
    coin: 'BTC',
    dexId: '',
    editKind: 'triggerMarket',
    expectedLimitPrice: '101.2',
    expectedOrderType: 'Take Profit Market',
    expectedRemainingSize: '0.4',
    expectedTriggerPrice: '110',
    marketKey: 'hyperliquid::BTC',
    oid: 9,
    pxDecimals: 2,
    reduceOnly: false,
    side: 'buy',
    szDecimals: 3,
    triggerKind: 'takeProfit',
    triggerPrice: '120',
  });

const dependencies = (
  overrides: Partial<PerpsModifyOpenOrderDependencies> = {},
): PerpsModifyOpenOrderDependencies => ({
  getCurrentAccount: () => account,
  getCurrentDex: () => '',
  getOrderStatus: jest.fn(async () => ({
    order: {
      order: liveOrder,
      status: 'open',
      statusTimestamp: 1,
    },
    status: 'order',
  })),
  hasPermission: () => true,
  modifyOrder: jest.fn(async () => ({
    response: { type: 'default' },
    status: 'ok',
  })),
  refreshClearinghouse: jest.fn(),
  refreshOpenOrders: jest.fn(),
  ...overrides,
});

describe('Perps modify open order action', () => {
  it('freezes a complete replacement and rounds down to market precision', () => {
    expect(command()).toMatchObject({
      expected: {
        kind: 'limit',
        limitPrice: '50000',
        reduceOnly: true,
        remainingSize: '0.004',
        side: 'sell',
        tif: 'Alo',
      },
      replacement: { baseSize: '0.00345', limitPrice: '51000.12' },
      type: 'modifyOpenOrder',
    });
  });

  it('accepts the modify default response and preserves replacement fields', async () => {
    const deps = dependencies();
    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'updated', refreshError: undefined },
    );
    expect(deps.modifyOrder).toHaveBeenCalledWith({
      coin: 'BTC',
      isBuy: false,
      limitPx: '51000.12',
      oid: 7,
      orderType: { limit: { tif: 'Alo' } },
      reduceOnly: true,
      sz: '0.00345',
    });
    expect(deps.refreshOpenOrders).toHaveBeenCalledWith('');
    expect(deps.refreshClearinghouse).toHaveBeenCalledWith('');
  });

  it('modifies an opening Trigger Market directly and preserves its protection ratio', async () => {
    const deps = dependencies({
      getOrderStatus: jest.fn(async () => ({
        order: {
          order: triggerMarketOrder,
          status: 'open',
          statusTimestamp: 1,
        },
        status: 'order',
      })),
    });
    expect(triggerCommand()).toMatchObject({
      expected: {
        kind: 'triggerMarket',
        reduceOnly: false,
        triggerKind: 'takeProfit',
        triggerPrice: '110',
      },
      replacement: {
        baseSize: '0.5',
        limitPrice: '110.4',
        orderType: {
          trigger: { isMarket: true, triggerPx: '120', tpsl: 'tp' },
        },
        triggerPrice: '120',
      },
    });
    const trigger = triggerCommand().replacement.orderType as {
      trigger: Record<string, unknown>;
    };
    expect(Object.keys(trigger.trigger)).toEqual([
      'isMarket',
      'triggerPx',
      'tpsl',
    ]);
    await expect(
      executePerpsModifyOpenOrder(triggerCommand(), deps),
    ).resolves.toEqual({ kind: 'updated', refreshError: undefined });
    expect(deps.modifyOrder).toHaveBeenCalledWith({
      coin: 'BTC',
      isBuy: true,
      limitPx: '110.4',
      oid: 9,
      orderType: {
        trigger: { isMarket: true, triggerPx: '120', tpsl: 'tp' },
      },
      reduceOnly: false,
      sz: '0.5',
    });
  });

  it('builds a Position Trigger Limit with untouched dynamic size zero', () => {
    expect(
      buildPerpsModifyOpenOrderCommand({
        account,
        baseSize: '0',
        coin: 'BTC',
        dexId: '',
        editKind: 'triggerLimit',
        expectedIsPositionTpsl: true,
        expectedLimitPrice: '90',
        expectedOrderType: 'Stop Limit',
        expectedRemainingSize: '0',
        expectedTriggerPrice: '95',
        limitPrice: '91',
        marketKey: 'hyperliquid::BTC',
        oid: 10,
        pxDecimals: 2,
        reduceOnly: true,
        side: 'sell',
        szDecimals: 3,
        triggerKind: 'stopLoss',
        triggerPrice: '96',
      }),
    ).toMatchObject({
      expected: { isPositionTpsl: true, remainingSize: '0' },
      replacement: {
        baseSize: '0',
        limitPrice: '91',
        orderType: {
          trigger: { isMarket: false, triggerPx: '96', tpsl: 'sl' },
        },
      },
    });
  });

  it('retains compatibility with a legacy resting order response', async () => {
    const deps = dependencies({
      modifyOrder: jest.fn(async () => ({
        response: { data: { statuses: [{ resting: { oid: 7 } }] } },
        status: 'ok',
      })),
    });

    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'resting', oid: 7, refreshError: undefined },
    );
    expect(deps.refreshOpenOrders).toHaveBeenCalledWith('');
    expect(deps.refreshClearinghouse).not.toHaveBeenCalled();
  });

  it('returns the authoritative latest order when its remaining size changed', async () => {
    const latestOrder = { ...liveOrder, sz: '0.0039' };
    const deps = dependencies({
      getOrderStatus: jest.fn(async () => ({
        order: {
          order: latestOrder,
          status: 'open',
          statusTimestamp: 2,
        },
        status: 'order',
      })),
    });
    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      {
        kind: 'staleContext',
        latestOrder,
        staleReason: 'orderChanged',
      },
    );
    expect(deps.modifyOrder).not.toHaveBeenCalled();
  });

  it('fails stale before signing when orderStatus exposes attached children', async () => {
    const latestOrder = {
      ...liveOrder,
      children: [{ ...liveOrder, oid: 8 }],
    };
    const deps = dependencies({
      getOrderStatus: jest.fn(async () => ({
        order: {
          order: latestOrder,
          status: 'open',
          statusTimestamp: 1,
        },
        status: 'order',
      })),
    });
    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      {
        kind: 'staleContext',
        latestOrder,
        staleReason: 'orderChanged',
      },
    );
    expect(deps.modifyOrder).not.toHaveBeenCalled();
  });

  it('lets the authenticated modify endpoint decide after unknownOid', async () => {
    const deps = dependencies({
      getOrderStatus: jest.fn(async () => ({ status: 'unknownOid' })),
    });

    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'updated', refreshError: undefined },
    );
    expect(deps.modifyOrder).toHaveBeenCalledTimes(1);
  });

  it('lets the authenticated modify endpoint decide after orderStatus transport failure', async () => {
    const deps = dependencies({
      getOrderStatus: jest.fn(async () => {
        throw new Error('failed to fetch order status');
      }),
    });

    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'updated', refreshError: undefined },
    );
    expect(deps.modifyOrder).toHaveBeenCalledTimes(1);
  });

  it('does not submit an order that orderStatus says is no longer open', async () => {
    const deps = dependencies({
      getOrderStatus: jest.fn(async () => ({
        order: {
          order: liveOrder,
          status: 'canceled',
          statusTimestamp: 2,
        },
        status: 'order',
      })),
    });

    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'staleContext', staleReason: 'orderClosed' },
    );
    expect(deps.modifyOrder).not.toHaveBeenCalled();
  });

  it('preserves a known server acceptance after dispatch even if the account changes', async () => {
    let currentAccount = account;
    const deps = dependencies({
      getCurrentAccount: () => currentAccount,
      modifyOrder: jest.fn(async () => {
        currentAccount = {
          ...account,
          address: '0x0000000000000000000000000000000000000002',
        };
        return { response: { type: 'default' }, status: 'ok' };
      }),
    });

    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'updated', refreshError: undefined },
    );
  });

  it('refreshes both position and orders when the replacement fills', async () => {
    const deps = dependencies({
      modifyOrder: jest.fn(async () => ({
        response: { data: { statuses: [{ filled: { oid: 7 } }] } },
        status: 'ok',
      })),
    });
    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'filled', oid: 7, refreshError: undefined },
    );
    expect(deps.refreshClearinghouse).toHaveBeenCalledWith('');
    expect(deps.refreshOpenOrders).toHaveBeenCalledWith('');
  });

  it('returns the explicit Hyperliquid rejection message', async () => {
    const deps = dependencies({
      modifyOrder: jest.fn(async () => ({
        response: {
          data: {
            statuses: [{ error: 'Order must have minimum value of $10.' }],
          },
          type: 'order',
        },
        status: 'ok',
      })),
    });

    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      {
        error: 'Order must have minimum value of $10.',
        failureReason: 'requestFailed',
        kind: 'failed',
      },
    );
    expect(deps.refreshOpenOrders).not.toHaveBeenCalled();
  });

  it('treats an unrecognized successful envelope as unknown after refresh', async () => {
    const deps = dependencies({
      modifyOrder: jest.fn(async () => ({
        response: { type: 'future-response' },
        status: 'ok',
      })),
    });

    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      {
        error: 'Missing Hyperliquid order modification outcome',
        kind: 'unknownOutcome',
        refreshError: undefined,
      },
    );
    expect(deps.refreshClearinghouse).toHaveBeenCalledWith('');
    expect(deps.refreshOpenOrders).toHaveBeenCalledWith('');
  });

  it('refreshes both facts and reports unknown outcome on timeout', async () => {
    const deps = dependencies({
      modifyOrder: jest.fn(async () => {
        throw new Error('network request failed');
      }),
    });
    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      {
        error: 'network request failed',
        kind: 'unknownOutcome',
        refreshError: undefined,
      },
    );
    expect(deps.refreshClearinghouse).toHaveBeenCalledWith('');
    expect(deps.refreshOpenOrders).toHaveBeenCalledWith('');
  });
});
