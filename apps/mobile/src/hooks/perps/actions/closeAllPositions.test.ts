jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchAllDexsClearinghouseStateHttp: jest.fn(),
  fetchAllDexsPositionOpenOrdersHttp: jest.fn(),
  perpsStore: { getState: jest.fn(() => ({})) },
}));

import type {
  ClearinghouseState,
  OpenOrder,
} from '@rabby-wallet/hyperliquid-sdk';

import {
  buildPerpsCloseAllPositionsCommand,
  executePerpsCloseAllPositions,
  type CloseAllPositionsDependencies,
} from './closeAllPositions';

const account = { address: '0xabc', type: 'PrivateKey' };
const state = {
  assetPositions: [
    { position: { coin: 'BTC', szi: '1' } },
    { position: { coin: 'ETH', szi: '-2' } },
  ],
} as unknown as ClearinghouseState;

const openOrder = (
  oid: number,
  overrides: Partial<OpenOrder> = {},
): OpenOrder =>
  ({
    children: [],
    coin: 'BTC',
    isPositionTpsl: true,
    isTrigger: true,
    limitPx: '100',
    oid,
    orderType: 'Take Profit Market',
    origSz: '1',
    reduceOnly: true,
    side: 'A',
    sz: '1',
    tif: null,
    timestamp: oid,
    triggerCondition: 'markPx above 100',
    triggerPx: '100',
    ...overrides,
  } as OpenOrder);

const dependencies = (
  overrides: Partial<CloseAllPositionsDependencies> = {},
): CloseAllPositionsDependencies => ({
  cancelOrders: jest.fn(async command => ({
    items: command.orders.map(order => ({ ...order, status: 'success' })),
    kind: 'success',
  })),
  closeAllPositions: jest.fn(async () => ({
    status: 'ok',
    response: {
      data: {
        statuses: [
          { filled: { avgPx: '100', oid: 1, totalSz: '1' } },
          { filled: { avgPx: '50', oid: 2, totalSz: '2' } },
        ],
      },
    },
  })),
  getCurrentAccount: () => account,
  getCurrentClearinghouseState: () => state,
  getCurrentOpenOrders: () => [],
  refreshAllClearinghouse: jest.fn(),
  refreshAllOpenOrders: jest.fn(),
  ...overrides,
});

describe('Perps close all positions action', () => {
  it('freezes only active reduce-only trigger orders for current position coins', () => {
    const dormantAttached = openOrder(6, { isPositionTpsl: false });
    const orders = [
      openOrder(1),
      openOrder(2, { isPositionTpsl: false }),
      openOrder(3, { isTrigger: false, orderType: 'Limit' }),
      openOrder(4, { coin: 'SOL' }),
      openOrder(5, {
        children: [dormantAttached],
        isPositionTpsl: false,
        isTrigger: false,
        orderType: 'Limit',
        reduceOnly: false,
      }),
    ];

    const command = buildPerpsCloseAllPositionsCommand(account, state, orders);

    expect(command.tpSlOrders).toEqual([
      { coin: 'BTC', oid: 1 },
      { coin: 'BTC', oid: 2 },
    ]);
  });

  it('cancels associated TP/SL before submitting the 8% close batch', async () => {
    const events: string[] = [];
    let liveOrders = [openOrder(1), openOrder(2, { isPositionTpsl: false })];
    const deps = dependencies({
      cancelOrders: jest.fn(async command => {
        events.push('cancel');
        liveOrders = [];
        return {
          items: command.orders.map(order => ({
            ...order,
            status: 'success' as const,
          })),
          kind: 'success',
        };
      }),
      closeAllPositions: jest.fn(async () => {
        events.push('close');
        return {
          status: 'ok',
          response: {
            data: {
              statuses: [
                { filled: { avgPx: '100', oid: 1, totalSz: '1' } },
                { filled: { avgPx: '50', oid: 2, totalSz: '2' } },
              ],
            },
          },
        };
      }),
      getCurrentOpenOrders: () => liveOrders,
    });
    const command = buildPerpsCloseAllPositionsCommand(
      account,
      state,
      liveOrders,
    );

    await expect(executePerpsCloseAllPositions(command, deps)).resolves.toEqual(
      {
        confirmedFills: [
          {
            coin: 'BTC',
            oid: 1,
            price: '100',
            signedSize: '1',
            size: '1',
          },
          {
            coin: 'ETH',
            oid: 2,
            price: '50',
            signedSize: '-2',
            size: '2',
          },
        ],
        kind: 'success',
        refreshError: undefined,
      },
    );
    expect(events).toEqual(['cancel', 'close']);
    expect(deps.cancelOrders).toHaveBeenCalledWith(
      expect.objectContaining({ orders: command.tpSlOrders }),
    );
    expect(deps.closeAllPositions).toHaveBeenCalledWith(
      state,
      0.08,
      expect.objectContaining({ address: expect.any(String) }),
    );
    expect(deps.refreshAllOpenOrders).toHaveBeenCalledTimes(2);
    expect(deps.refreshAllClearinghouse).toHaveBeenCalledTimes(2);
  });

  it('preserves normal orders and skips cancellation when no associated TP/SL exists', async () => {
    const normalOrders = [
      openOrder(3, {
        isPositionTpsl: false,
        isTrigger: false,
        orderType: 'Limit',
        reduceOnly: false,
      }),
    ];
    const deps = dependencies({ getCurrentOpenOrders: () => normalOrders });
    const command = buildPerpsCloseAllPositionsCommand(
      account,
      state,
      normalOrders,
    );

    await executePerpsCloseAllPositions(command, deps);

    expect(command.tpSlOrders).toEqual([]);
    expect(deps.cancelOrders).not.toHaveBeenCalled();
    expect(deps.closeAllPositions).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed position or TP/SL snapshot before signing', async () => {
    const target = openOrder(1);
    const changedPositionDeps = dependencies({
      getCurrentClearinghouseState: () =>
        ({
          assetPositions: [{ position: { coin: 'BTC', szi: '0.5' } }],
        } as unknown as ClearinghouseState),
      getCurrentOpenOrders: () => [target],
    });
    const command = buildPerpsCloseAllPositionsCommand(account, state, [
      target,
    ]);
    await expect(
      executePerpsCloseAllPositions(command, changedPositionDeps),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(changedPositionDeps.cancelOrders).not.toHaveBeenCalled();

    const changedOrderDeps = dependencies({ getCurrentOpenOrders: () => [] });
    await expect(
      executePerpsCloseAllPositions(command, changedOrderDeps),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(changedOrderDeps.cancelOrders).not.toHaveBeenCalled();
  });

  it('does not close positions after partial TP/SL cancellation', async () => {
    const target = openOrder(1);
    const deps = dependencies({
      cancelOrders: jest.fn(async () => ({
        items: [
          {
            coin: 'BTC',
            error: 'cancel rejected',
            oid: 1,
            status: 'failed',
          },
        ],
        kind: 'failed',
      })),
      getCurrentOpenOrders: () => [target],
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state, [target]),
        deps,
      ),
    ).resolves.toMatchObject({
      error: 'cancel rejected',
      kind: 'failed',
      stage: 'cancelTpSl',
    });
    expect(deps.closeAllPositions).not.toHaveBeenCalled();
    expect(deps.refreshAllOpenOrders).toHaveBeenCalledTimes(1);
    expect(deps.refreshAllClearinghouse).toHaveBeenCalledTimes(1);
  });

  it('stops before close when a new associated TP/SL appears after cancellation', async () => {
    const target = openOrder(1);
    let liveOrders = [target];
    const deps = dependencies({
      cancelOrders: jest.fn(async command => {
        liveOrders = [openOrder(2)];
        return {
          items: command.orders.map(order => ({
            ...order,
            status: 'success' as const,
          })),
          kind: 'success',
        };
      }),
      getCurrentOpenOrders: () => liveOrders,
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state, [target]),
        deps,
      ),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(deps.closeAllPositions).not.toHaveBeenCalled();
  });

  it('reports failure and refreshes both snapshots after a partial batch fill', async () => {
    const deps = dependencies({
      closeAllPositions: jest.fn(async () => ({
        status: 'ok',
        response: {
          data: {
            statuses: [
              { filled: { avgPx: '100', oid: 1, totalSz: '1' } },
              { error: 'insufficient liquidity' },
            ],
          },
        },
      })),
    });
    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state, []),
        deps,
      ),
    ).resolves.toMatchObject({
      confirmedFills: [
        {
          coin: 'BTC',
          oid: 1,
          price: '100',
          signedSize: '1',
          size: '1',
        },
      ],
      error: 'insufficient liquidity',
      kind: 'failed',
      stage: 'closePositions',
    });
    expect(deps.refreshAllOpenOrders).toHaveBeenCalledTimes(1);
    expect(deps.refreshAllClearinghouse).toHaveBeenCalledTimes(1);
  });

  it('preserves server fills when the account changes after submission', async () => {
    let currentAccount: typeof account | null = account;
    const deps = dependencies({
      closeAllPositions: jest.fn(async () => {
        currentAccount = null;
        return {
          status: 'ok',
          response: {
            data: {
              statuses: [
                { filled: { avgPx: '100', oid: 1, totalSz: '1' } },
                { filled: { avgPx: '50', oid: 2, totalSz: '2' } },
              ],
            },
          },
        };
      }),
      getCurrentAccount: () => currentAccount,
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state, []),
        deps,
      ),
    ).resolves.toMatchObject({
      confirmedFills: [
        {
          coin: 'BTC',
          oid: 1,
          price: '100',
          signedSize: '1',
          size: '1',
        },
        {
          coin: 'ETH',
          oid: 2,
          price: '50',
          signedSize: '-2',
          size: '2',
        },
      ],
      kind: 'staleContext',
    });
    expect(deps.refreshAllOpenOrders).not.toHaveBeenCalled();
    expect(deps.refreshAllClearinghouse).not.toHaveBeenCalled();
  });
});
