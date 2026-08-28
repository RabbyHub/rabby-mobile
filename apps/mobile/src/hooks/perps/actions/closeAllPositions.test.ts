jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchAllDexsClearinghouseStateHttp: jest.fn(),
  fetchAllDexsPositionOpenOrdersHttp: jest.fn(),
  perpsStore: { getState: jest.fn(() => ({})) },
}));

import type { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';

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
const emptyState = { assetPositions: [] } as unknown as ClearinghouseState;

const successfulResponse = {
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

const dependencies = (
  overrides: Partial<CloseAllPositionsDependencies> = {},
): CloseAllPositionsDependencies => {
  let liveState = state;
  return {
    closeAllPositions: jest.fn(async () => successfulResponse),
    getCurrentAccount: () => account,
    getCurrentClearinghouseState: () => liveState,
    refreshAllClearinghouse: jest.fn(async () => {
      liveState = emptyState;
    }),
    refreshAllOpenOrders: jest.fn(),
    ...overrides,
  };
};

describe('Perps close all positions action', () => {
  it('freezes only the account and non-zero position snapshot', () => {
    const command = buildPerpsCloseAllPositionsCommand(account, state);

    expect(command.positions).toEqual([
      { coin: 'BTC', signedSize: '1' },
      { coin: 'ETH', signedSize: '-2' },
    ]);
    expect(command).not.toHaveProperty('tpSlOrders');
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.clearinghouseState)).toBe(true);
    expect(Object.isFrozen(command.positions)).toBe(true);
  });

  it('submits one 8% close batch without issuing a cancel request', async () => {
    const deps = dependencies();
    const command = buildPerpsCloseAllPositionsCommand(account, state);

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
    expect(deps.closeAllPositions).toHaveBeenCalledWith(
      command.clearinghouseState,
      0.08,
      expect.objectContaining({ address: expect.any(String) }),
    );
    expect(deps.refreshAllOpenOrders).toHaveBeenCalledTimes(1);
    expect(deps.refreshAllClearinghouse).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed position snapshot before signing', async () => {
    const deps = dependencies({
      getCurrentClearinghouseState: () =>
        ({
          assetPositions: [{ position: { coin: 'BTC', szi: '0.5' } }],
        } as unknown as ClearinghouseState),
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state),
        deps,
      ),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(deps.closeAllPositions).not.toHaveBeenCalled();
    expect(deps.refreshAllOpenOrders).not.toHaveBeenCalled();
    expect(deps.refreshAllClearinghouse).not.toHaveBeenCalled();
  });

  it('keeps every authoritative server rejection instead of replacing it with a generic error', async () => {
    const deps = dependencies({
      closeAllPositions: jest.fn(async () => ({
        status: 'ok',
        response: {
          data: {
            statuses: [
              { error: 'Insufficient margin to place order.' },
              { error: 'Order price too far from oracle' },
            ],
          },
        },
      })),
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state),
        deps,
      ),
    ).resolves.toMatchObject({
      confirmedFills: [],
      error:
        'Insufficient margin to place order.\nOrder price too far from oracle',
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    expect(deps.refreshAllOpenOrders).toHaveBeenCalledTimes(1);
    expect(deps.refreshAllClearinghouse).toHaveBeenCalledTimes(1);
  });

  it('does not report success when a filled status covers only part of the submitted size', async () => {
    const deps = dependencies({
      closeAllPositions: jest.fn(async () => ({
        status: 'ok',
        response: {
          data: {
            statuses: [
              { filled: { avgPx: '100', oid: 1, totalSz: '0.4' } },
              { filled: { avgPx: '50', oid: 2, totalSz: '2' } },
            ],
          },
        },
      })),
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state),
        deps,
      ),
    ).resolves.toMatchObject({
      confirmedFills: [
        {
          coin: 'BTC',
          oid: 1,
          price: '100',
          signedSize: '1',
          size: '0.4',
        },
        {
          coin: 'ETH',
          oid: 2,
          price: '50',
          signedSize: '-2',
          size: '2',
        },
      ],
      error: 'BTC was filled 0.4 of 1',
      kind: 'failed',
    });
  });

  it('requires the refreshed target positions to be zero before reporting success', async () => {
    const deps = dependencies({
      getCurrentClearinghouseState: () => state,
      refreshAllClearinghouse: jest.fn(),
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state),
        deps,
      ),
    ).resolves.toMatchObject({
      error:
        'BTC position remains open (1) after close request\nETH position remains open (2) after close request',
      kind: 'failed',
    });
  });

  it('reports an unknown outcome when the authoritative position refresh fails', async () => {
    const deps = dependencies({
      refreshAllClearinghouse: jest.fn(async () => {
        throw new Error('clearinghouse refresh unavailable');
      }),
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state),
        deps,
      ),
    ).resolves.toMatchObject({
      error: 'clearinghouse refresh unavailable',
      kind: 'unknownOutcome',
      refreshError: 'clearinghouse refresh unavailable',
    });
  });

  it('keeps a verified close successful when only the Open Orders refresh fails', async () => {
    const deps = dependencies({
      refreshAllOpenOrders: jest.fn(async () => {
        throw new Error('open orders refresh unavailable');
      }),
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state),
        deps,
      ),
    ).resolves.toMatchObject({
      kind: 'success',
      refreshError: 'open orders refresh unavailable',
    });
  });

  it('treats a transport failure as unknown and refreshes before returning', async () => {
    const deps = dependencies({
      closeAllPositions: jest.fn(async () => {
        throw new Error('Network request failed');
      }),
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state),
        deps,
      ),
    ).resolves.toMatchObject({
      error: 'Network request failed',
      kind: 'unknownOutcome',
    });
    expect(deps.refreshAllOpenOrders).toHaveBeenCalledTimes(1);
    expect(deps.refreshAllClearinghouse).toHaveBeenCalledTimes(1);
  });

  it('preserves server fills when the account changes after submission', async () => {
    let currentAccount: typeof account | null = account;
    const deps = dependencies({
      closeAllPositions: jest.fn(async () => {
        currentAccount = null;
        return successfulResponse;
      }),
      getCurrentAccount: () => currentAccount,
    });

    await expect(
      executePerpsCloseAllPositions(
        buildPerpsCloseAllPositionsCommand(account, state),
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
