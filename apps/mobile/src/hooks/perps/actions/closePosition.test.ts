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
  finalizePerpsMarketClosePositionCommand,
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
    reportingFacts: { leverage: 5, marginMode: 'cross' },
    size: '0.61729',
    szDecimals: 4,
  });
const dependencies = (
  overrides: Partial<ClosePositionDependencies> = {},
): ClosePositionDependencies => ({
  getCurrentAccount: () => account,
  getLiveMidPrice: () => '100',
  getLiveSignedSize: () => '1.2345',
  limitClose: jest.fn(),
  marketClose: jest.fn(async () => ({
    status: 'ok',
    response: {
      data: {
        statuses: [{ filled: { avgPx: '99', oid: 1, totalSz: '0.6172' } }],
      },
    },
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
      confirmed: {
        acceptance: 'filled',
        oid: 1,
        price: '99',
        size: '0.6172',
      },
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

  it('late-binds the latest Mid without changing the frozen close size', async () => {
    const deps = dependencies({ getLiveMidPrice: () => '90' });
    const frozen = command();
    const finalized = finalizePerpsMarketClosePositionCommand(frozen, '90');

    expect(finalized).toMatchObject({
      midPrice: '90',
      size: frozen.size,
    });
    expect(Object.isFrozen(finalized)).toBe(true);

    await executePerpsClosePosition(frozen, deps);
    expect(deps.marketClose).toHaveBeenCalledWith(
      expect.objectContaining({ midPx: '90', size: frozen.size }),
    );
  });

  it('fails closed when the latest Market Mid is unavailable', async () => {
    const deps = dependencies({ getLiveMidPrice: () => null });

    await expect(executePerpsClosePosition(command(), deps)).resolves.toEqual({
      kind: 'staleContext',
    });
    expect(deps.marketClose).not.toHaveBeenCalled();
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
      reportingFacts: { leverage: 3, marginMode: 'isolated' },
      size: '2',
      szDecimals: 4,
    });
    deps.getLiveSignedSize = () => '-2';
    await expect(executePerpsClosePosition(limit, deps)).resolves.toEqual({
      confirmed: {
        acceptance: 'resting',
        oid: 9,
        price: '101',
        size: '2',
      },
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

  it('accepts only a protocol-canonical limit price from the editor', () => {
    const buildLimit = (limitPrice: string) =>
      buildPerpsClosePositionCommand({
        account,
        coin: 'BTC',
        direction: 'long',
        expectedPositionSize: '1',
        limitPrice,
        midPrice: '100',
        orderType: 'limit',
        pxDecimals: 2,
        reportingFacts: { leverage: 5, marginMode: 'cross' },
        size: '1',
        szDecimals: 4,
      });

    expect(buildLimit('101.23').limitPrice).toBe('101.23');
    expect(() => buildLimit('101.239')).toThrow('Invalid Perps limit price');
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
        reportingFacts: { leverage: 5, marginMode: 'cross' },
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
        reportingFacts: { leverage: 5, marginMode: 'cross' },
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

  it('preserves server acceptance when the account changes after submission', async () => {
    let currentAccount: typeof account | null = account;
    const deps = dependencies({
      getCurrentAccount: () => currentAccount,
      marketClose: jest.fn(async () => {
        currentAccount = null;
        return {
          status: 'ok',
          response: {
            data: {
              statuses: [
                {
                  filled: { avgPx: '99', oid: 1, totalSz: '0.6172' },
                },
              ],
            },
          },
        };
      }),
    });

    await expect(executePerpsClosePosition(command(), deps)).resolves.toEqual({
      confirmed: {
        acceptance: 'filled',
        oid: 1,
        price: '99',
        size: '0.6172',
      },
      kind: 'staleContext',
    });
    expect(deps.refreshClearinghouse).not.toHaveBeenCalled();
  });
});
