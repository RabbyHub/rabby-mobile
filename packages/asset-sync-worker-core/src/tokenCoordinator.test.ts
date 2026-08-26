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
      applied: true,
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
    expect(receipt.addresses[0]).toStrictEqual({
      address: '0xabc',
      outcome: 'complete',
      chainIds: ['eth', 'arb'],
      failedChainIds: [],
      committedRowCount: 2,
      committedAt: request.issuedAt,
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
    expect(receipt.addresses[0].failedChainIds).toStrictEqual(['arb']);
    expect(commitTokenSnapshot).not.toHaveBeenCalled();
  });

  it('deduplicates the same request while it is in flight', async () => {
    let resolveChains: ((value: { id: string }[]) => void) | undefined;
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: () =>
          new Promise(resolve => {
            resolveChains = resolve;
          }),
        listToken: async () => [],
      },
      persistence: {
        commitTokenSnapshot: async ({ rows }) => ({
          rowCount: rows.length,
          applied: true,
        }),
      },
      now: () => 10,
    });

    const first = coordinator.sync(request);
    const second = coordinator.sync(request);
    expect(second).toBe(first);

    resolveChains?.([]);
    expect(await first).toMatchObject({ outcome: 'complete' });
  });

  it('bounds chain requests globally across addresses', async () => {
    let activeCount = 0;
    let maxActiveCount = 0;
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: async () => [{ id: 'eth' }, { id: 'arb' }, { id: 'op' }],
        listToken: async (_address, chain) => {
          activeCount += 1;
          maxActiveCount = Math.max(maxActiveCount, activeCount);
          await Promise.resolve();
          activeCount -= 1;
          return [{ id: `token-${chain}`, chain }];
        },
      },
      persistence: {
        commitTokenSnapshot: async ({ rows }) => ({
          rowCount: rows.length,
          applied: true,
        }),
      },
      addressConcurrency: 3,
      chainConcurrency: 2,
      now: () => 10,
    });

    await coordinator.sync({
      ...request,
      addresses: ['0x1', '0x2', '0x3'],
    });

    expect(maxActiveCount).toBe(2);
  });

  it('treats a transaction superseded by a newer snapshot as complete', async () => {
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: async () => [{ id: 'eth' }],
        listToken: async () => [{ id: 'eth', chain: 'eth' }],
      },
      persistence: {
        commitTokenSnapshot: async () => ({ rowCount: 0, applied: false }),
      },
      now: () => 20,
    });

    expect(await coordinator.sync(request)).toMatchObject({
      outcome: 'complete',
      addresses: [
        {
          outcome: 'complete',
          committedRowCount: 0,
          superseded: true,
        },
      ],
    });
  });

  it('does not start API or persistence work for a cancelled request', async () => {
    const usedChainList = jest.fn();
    const commitTokenSnapshot = jest.fn();
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList,
        listToken: jest.fn(),
      },
      persistence: { commitTokenSnapshot },
      isCancelled: () => true,
    });

    expect(await coordinator.sync(request)).toMatchObject({
      outcome: 'cancelled',
      addresses: [{ outcome: 'cancelled' }],
    });
    expect(usedChainList).not.toHaveBeenCalled();
    expect(commitTokenSnapshot).not.toHaveBeenCalled();
  });

  it('does not persist when cancellation arrives after chain reads', async () => {
    let cancelled = false;
    const commitTokenSnapshot = jest.fn();
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: async () => [{ id: 'eth' }],
        listToken: async () => {
          cancelled = true;
          return [{ id: 'eth', chain: 'eth' }];
        },
      },
      persistence: { commitTokenSnapshot },
      isCancelled: () => cancelled,
    });

    expect(await coordinator.sync(request)).toMatchObject({
      outcome: 'cancelled',
      addresses: [{ outcome: 'cancelled' }],
    });
    expect(commitTokenSnapshot).not.toHaveBeenCalled();
  });
});
