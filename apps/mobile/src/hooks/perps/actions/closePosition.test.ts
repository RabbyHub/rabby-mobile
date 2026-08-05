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
  });

  it('rejects a changed position snapshot before submitting', async () => {
    const deps = dependencies({ getLiveSignedSize: () => '1' });
    await expect(executePerpsClosePosition(command(), deps)).resolves.toEqual({
      kind: 'staleContext',
    });
    expect(deps.marketClose).not.toHaveBeenCalled();
  });
});
