jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  fetchPositionOpenOrdersHttp: jest.fn(),
  getDexByCoin: jest.fn(() => ''),
  perpsStore: { getState: jest.fn(() => ({})) },
}));

import {
  buildPerpsClosePositionCommand,
  executePerpsClosePosition,
  PERPS_CLOSE_MINIMUM_NOTIONAL_ERROR,
  validatePerpsCloseAmount,
  type ClosePositionDependencies,
} from './closePosition';

const account = { address: '0xabc', type: 'PrivateKey' };
const command = () =>
  buildPerpsClosePositionCommand({
    account,
    coin: 'BTC',
    direction: 'long',
    expectedPositionSize: '1.2345',
    limitPrice: null,
    midPrice: '100',
    orderType: 'market',
    pxDecimals: 2,
    size: '0.61729',
    szDecimals: 4,
  });
const dependencies = (
  overrides: Partial<ClosePositionDependencies> = {},
): ClosePositionDependencies => ({
  getCurrentAccount: () => account,
  getLiveSignedSize: () => '1.2345',
  limitClose: jest.fn(),
  marketClose: jest.fn(async () => ({
    status: 'ok',
    response: { data: { statuses: [{ filled: { oid: 1 } }] } },
  })),
  refreshClearinghouse: jest.fn(),
  refreshOpenOrders: jest.fn(),
  resolveDex: () => '',
  ...overrides,
});

describe('Perps close position action', () => {
  it('rounds size down and always submits a reduce-only opposite-side market order', async () => {
    const deps = dependencies();
    await expect(executePerpsClosePosition(command(), deps)).resolves.toEqual({
      kind: 'filled',
      oid: 1,
      refreshError: undefined,
    });
    expect(deps.marketClose).toHaveBeenCalledWith(
      expect.objectContaining({
        isBuy: false,
        reduceOnly: true,
        size: '0.6172',
      }),
    );
  });

  it('submits a GTC reduce-only limit close and refreshes open orders', async () => {
    const deps = dependencies({
      limitClose: jest.fn(async () => ({
        status: 'ok',
        response: { data: { statuses: [{ resting: { oid: 9 } }] } },
      })),
    });
    const limit = buildPerpsClosePositionCommand({
      account,
      coin: 'BTC',
      direction: 'short',
      expectedPositionSize: '2',
      limitPrice: '101',
      midPrice: '100',
      orderType: 'limit',
      pxDecimals: 2,
      size: '2',
      szDecimals: 4,
    });
    deps.getLiveSignedSize = () => '-2';
    await expect(executePerpsClosePosition(limit, deps)).resolves.toEqual({
      kind: 'resting',
      oid: 9,
      refreshError: undefined,
    });
    expect(deps.limitClose).toHaveBeenCalledWith(
      expect.objectContaining({ isBuy: true, reduceOnly: true, tif: 'Gtc' }),
    );
    expect(deps.refreshOpenOrders).toHaveBeenCalled();
    expect(deps.refreshClearinghouse).toHaveBeenCalled();
  });

  it('normalizes a limit price to the market price precision', () => {
    const limit = buildPerpsClosePositionCommand({
      account,
      coin: 'BTC',
      direction: 'long',
      expectedPositionSize: '1',
      limitPrice: '101.239',
      midPrice: '100',
      orderType: 'limit',
      pxDecimals: 2,
      size: '1',
      szDecimals: 4,
    });
    expect(limit.limitPrice).toBe('101.23');
  });

  it('rejects a partial close below $10 after size normalization', () => {
    expect(
      validatePerpsCloseAmount({
        expectedPositionSize: '1',
        referencePrice: '100',
        size: '0.0999',
      }),
    ).toEqual({ kind: 'invalid', reason: 'belowMinimumNotional' });
    expect(() =>
      buildPerpsClosePositionCommand({
        account,
        coin: 'BTC',
        direction: 'long',
        expectedPositionSize: '1',
        limitPrice: null,
        midPrice: '100',
        orderType: 'market',
        pxDecimals: 2,
        size: '0.09999',
        szDecimals: 4,
      }),
    ).toThrow(PERPS_CLOSE_MINIMUM_NOTIONAL_ERROR);
  });

  it('allows a full close below $10 without increasing its size', () => {
    expect(
      buildPerpsClosePositionCommand({
        account,
        coin: 'BTC',
        direction: 'long',
        expectedPositionSize: '0.05',
        limitPrice: null,
        midPrice: '100',
        orderType: 'market',
        pxDecimals: 2,
        size: '0.05',
        szDecimals: 4,
      }).size,
    ).toBe('0.05');
  });

  it('classifies the Hyperliquid minimum-notional rejection', async () => {
    const deps = dependencies({
      marketClose: jest.fn(async () => {
        throw new Error('Order must have minimum value of $10.');
      }),
    });

    await expect(executePerpsClosePosition(command(), deps)).resolves.toEqual({
      error: 'Order must have minimum value of $10.',
      failureReason: 'minimumNotional',
      kind: 'failed',
    });
  });

  it('rejects a changed position snapshot before submitting', async () => {
    const deps = dependencies({ getLiveSignedSize: () => '1' });
    await expect(executePerpsClosePosition(command(), deps)).resolves.toEqual({
      kind: 'staleContext',
    });
    expect(deps.marketClose).not.toHaveBeenCalled();
  });
});
