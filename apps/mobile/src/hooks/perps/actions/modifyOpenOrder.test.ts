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

const dependencies = (
  overrides: Partial<PerpsModifyOpenOrderDependencies> = {},
): PerpsModifyOpenOrderDependencies => ({
  getCurrentAccount: () => account,
  getCurrentDex: () => '',
  getLiveOpenOrders: () => [liveOrder],
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

  it('fails stale before signing when the live remaining size changed', async () => {
    const deps = dependencies({
      getLiveOpenOrders: () => [{ ...liveOrder, sz: '0.0039' }],
    });
    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'staleContext' },
    );
    expect(deps.modifyOrder).not.toHaveBeenCalled();
  });

  it('matches the frozen order by coin and oid when ids overlap across markets', async () => {
    const deps = dependencies({
      getLiveOpenOrders: () => [
        { ...liveOrder, coin: 'ETH', sz: '9' },
        liveOrder,
      ],
    });

    await expect(executePerpsModifyOpenOrder(command(), deps)).resolves.toEqual(
      { kind: 'updated', refreshError: undefined },
    );
    expect(deps.modifyOrder).toHaveBeenCalledTimes(1);
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
