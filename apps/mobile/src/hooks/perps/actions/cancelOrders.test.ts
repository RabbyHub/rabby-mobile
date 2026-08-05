jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchPositionOpenOrdersHttpForDexes: jest.fn(),
  getDexByCoin: jest.fn(),
  perpsStore: { getState: jest.fn() },
}));

jest.mock('./accountGuard', () => ({
  isSamePerpsActionAccount: (left: any, right: any) =>
    !!left &&
    !!right &&
    left.type === right.type &&
    left.address.toLowerCase() === right.address.toLowerCase(),
}));

import {
  buildPerpsCancelOrdersCommand,
  executePerpsCancelOrders,
  type CancelOrdersDependencies,
} from './cancelOrders';

const account = { address: '0xabc', type: 'PrivateKey' as any };

const dependencies = (
  overrides: Partial<CancelOrdersDependencies> = {},
): CancelOrdersDependencies => ({
  cancelOrders: jest.fn(async () => ({
    response: { data: { statuses: ['success'] } },
  })),
  getCurrentAccount: () => account,
  refreshDexes: jest.fn(async () => undefined),
  resolveDex: coin => (coin.includes(':') ? coin.split(':')[0]! : ''),
  ...overrides,
});

describe('Perps cancel order action', () => {
  it('builds an immutable, deduplicated command', () => {
    const command = buildPerpsCancelOrdersCommand(account, [
      { coin: ' BTC ', oid: 1 },
      { coin: 'BTC', oid: 1 },
      { coin: 'xyz:ETH', oid: 2 },
    ]);

    expect(command).toEqual({
      account,
      orders: [
        { coin: 'BTC', oid: 1 },
        { coin: 'xyz:ETH', oid: 2 },
      ],
      type: 'cancelOrders',
    });
    expect(Object.isFrozen(command)).toBe(true);
    expect(() => buildPerpsCancelOrdersCommand(account, [])).toThrow(
      'At least one Perps order is required',
    );
  });

  it('normalizes both runtime status shapes and refreshes successful dexes', async () => {
    const refreshDexes = jest.fn(async () => undefined);
    const command = buildPerpsCancelOrdersCommand(account, [
      { coin: 'BTC', oid: 1 },
      { coin: 'xyz:ETH', oid: 2 },
    ]);
    const result = await executePerpsCancelOrders(
      command,
      dependencies({
        cancelOrders: async () => ({
          response: {
            data: { statuses: ['success', { success: true }] },
          },
        }),
        refreshDexes,
      }),
    );

    expect(result.kind).toBe('success');
    expect(result.items.map(item => item.status)).toEqual([
      'success',
      'success',
    ]);
    expect(refreshDexes).toHaveBeenCalledWith(['', 'xyz']);
  });

  it('returns item-level partial failure without hiding the SDK error', async () => {
    const command = buildPerpsCancelOrdersCommand(account, [
      { coin: 'BTC', oid: 1 },
      { coin: 'ETH', oid: 2 },
    ]);
    const result = await executePerpsCancelOrders(
      command,
      dependencies({
        cancelOrders: async () => ({
          response: {
            data: { statuses: ['success', { error: 'Already canceled' }] },
          },
        }),
      }),
    );

    expect(result).toMatchObject({
      kind: 'partial',
      items: [
        { oid: 1, status: 'success' },
        { error: 'Already canceled', oid: 2, status: 'failed' },
      ],
    });
  });

  it('keeps cancellation success distinct from refresh and signer cancellation', async () => {
    const command = buildPerpsCancelOrdersCommand(account, [
      { coin: 'BTC', oid: 1 },
    ]);
    await expect(
      executePerpsCancelOrders(
        command,
        dependencies({
          refreshDexes: async () => {
            throw new Error('refresh unavailable');
          },
        }),
      ),
    ).resolves.toMatchObject({
      kind: 'success',
      refreshError: 'refresh unavailable',
    });

    await expect(
      executePerpsCancelOrders(
        command,
        dependencies({
          cancelOrders: () => Promise.reject('Canceled'),
        }),
      ),
    ).resolves.toMatchObject({
      failureReason: 'userCancelled',
      kind: 'failed',
    });
  });

  it('does not execute or refresh after an account-context change', async () => {
    const cancelOrders = jest.fn(async () => ({
      response: { data: { statuses: ['success'] } },
    }));
    const refreshDexes = jest.fn();
    const command = buildPerpsCancelOrdersCommand(account, [
      { coin: 'BTC', oid: 1 },
    ]);
    const staleAtStart = await executePerpsCancelOrders(
      command,
      dependencies({
        cancelOrders,
        getCurrentAccount: () => ({ ...account, address: '0xdef' }),
        refreshDexes,
      }),
    );
    expect(staleAtStart).toEqual({ items: [], kind: 'staleContext' });
    expect(cancelOrders).not.toHaveBeenCalled();

    let current = account;
    const staleAfterRequest = await executePerpsCancelOrders(
      command,
      dependencies({
        cancelOrders: async () => {
          current = { ...account, address: '0xdef' };
          return { response: { data: { statuses: ['success'] } } };
        },
        getCurrentAccount: () => current,
        refreshDexes,
      }),
    );
    expect(staleAfterRequest.kind).toBe('staleContext');
    expect(refreshDexes).not.toHaveBeenCalled();
  });
});
