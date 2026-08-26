import { ASSET_SYNC_WORKER_SCHEMA_VERSION } from './protocol';
import { createTokenAssetSyncCoordinator } from './tokenCoordinator';

const request = {
  schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
  requestId: 'request-1',
  kind: 'token' as const,
  addresses: ['0xABC'],
  force: true,
  issuedAt: 1,
  bootstrap: {
    host: 'https://example.test',
    apiKey: 'key',
    apiTime: 1,
    clientVersion: '0.0.0',
  },
};

describe('token asset sync coordinator', () => {
  it('commits one complete address snapshot without returning asset payloads', async () => {
    const commitTokenSnapshot = jest.fn(async ({ rows }) => ({
      rowCount: rows.length,
    }));
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: async () => [{ id: 'eth' }, { id: 'arb' }],
        listToken: async (_address, chain) => [
          { id: `token-${chain}`, chain, amount: 1 },
        ],
      },
      persistence: { commitTokenSnapshot },
      now: () => 10,
    });

    const receipt = await coordinator.sync(request);

    expect(receipt.outcome).toBe('complete');
    expect(receipt.addresses[0]).toEqual({
      address: '0xabc',
      outcome: 'complete',
      chainIds: ['eth', 'arb'],
      failedChainIds: [],
      committedRowCount: 2,
      committedAt: 10,
    });
    expect(commitTokenSnapshot).toHaveBeenCalledTimes(1);
    expect(receipt).not.toHaveProperty('tokens');
  });

  it('preserves the previous snapshot when any chain request fails', async () => {
    const commitTokenSnapshot = jest.fn();
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: async () => [{ id: 'eth' }, { id: 'arb' }],
        listToken: async (_address, chain) => {
          if (chain === 'arb') {
            throw new Error('network');
          }
          return [{ id: 'token-eth', chain }];
        },
      },
      persistence: { commitTokenSnapshot },
      now: () => 10,
    });

    const receipt = await coordinator.sync(request);

    expect(receipt.outcome).toBe('partial');
    expect(receipt.addresses[0].failedChainIds).toEqual(['arb']);
    expect(commitTokenSnapshot).not.toHaveBeenCalled();
  });

  it('deduplicates the same request while it is in flight', async () => {
    let resolveChains: ((value: Array<{ id: string }>) => void) | undefined;
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: () =>
          new Promise(resolve => {
            resolveChains = resolve;
          }),
        listToken: async () => [],
      },
      persistence: {
        commitTokenSnapshot: async ({ rows }) => ({ rowCount: rows.length }),
      },
      now: () => 10,
    });

    const first = coordinator.sync(request);
    const second = coordinator.sync(request);
    expect(second).toBe(first);

    resolveChains?.([]);
    await expect(first).resolves.toMatchObject({ outcome: 'complete' });
  });
});
