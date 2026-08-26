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
    const commitTokenSnapshot = jest.fn(async ({ rows, syncTimestamp }) => ({
      rowCount: rows.length,
      applied: true,
      committedAt: syncTimestamp,
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
    expect(receipt.addresses[0]).toMatchObject({
      schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
      requestId: request.requestId,
      kind: 'token',
      address: '0xabc',
      success: true,
      outcome: 'complete',
      generation: request.issuedAt,
      replacementScope: 'address',
      chainIds: ['eth', 'arb'],
      failedChainIds: [],
      committedRowCount: 2,
      committedAt: request.issuedAt,
      superseded: false,
      stage: 'committed',
      errorCode: '',
    });
    expect(commitTokenSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        replacementScope: 'address',
        chainIds: ['eth', 'arb'],
      }),
    );
    expect(commitTokenSnapshot).toHaveBeenCalledTimes(1);
    expect(receipt).not.toHaveProperty('tokens');
  });

  it('commits successful chains and preserves failed-chain snapshots', async () => {
    const commitTokenSnapshot = jest.fn(async ({ rows, syncTimestamp }) => ({
      rowCount: rows.length,
      applied: true,
      committedAt: syncTimestamp,
    }));
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
    expect(receipt.addresses[0]).toMatchObject({
      success: true,
      outcome: 'partial',
      replacementScope: 'chains',
      chainIds: ['eth'],
      failedChainIds: ['arb'],
      committedRowCount: 1,
      stage: 'committed',
      errorCode: 'asset_sync_partial_chain_failure',
    });
    expect(commitTokenSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        replacementScope: 'chains',
        chainIds: ['eth'],
        rows: [expect.objectContaining({ chain: 'eth' })],
      }),
    );
  });

  it('does not persist an empty sentinel for an empty successful partial chain', async () => {
    const commitTokenSnapshot = jest.fn(async ({ rows, syncTimestamp }) => ({
      rowCount: rows.length,
      applied: true,
      committedAt: syncTimestamp,
    }));
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: async () => [{ id: 'eth' }, { id: 'arb' }],
        listToken: async (_address, chain) => {
          if (chain === 'arb') {
            throw new Error('network');
          }
          return [];
        },
      },
      persistence: { commitTokenSnapshot },
    });

    expect(await coordinator.sync(request)).toMatchObject({
      outcome: 'partial',
      addresses: [{ committedRowCount: 0, chainIds: ['eth'] }],
    });
    expect(commitTokenSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ rows: [] }),
    );
  });

  it('does not persist when every chain request fails', async () => {
    const commitTokenSnapshot = jest.fn();
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: async () => [{ id: 'eth' }, { id: 'arb' }],
        listToken: async () => {
          throw new Error('network');
        },
      },
      persistence: { commitTokenSnapshot },
    });

    expect(await coordinator.sync(request)).toMatchObject({
      outcome: 'failed',
      addresses: [
        {
          success: false,
          outcome: 'failed',
          failedChainIds: ['eth', 'arb'],
          stage: 'chain-fetch',
        },
      ],
    });
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
        commitTokenSnapshot: async ({ rows, syncTimestamp }) => ({
          rowCount: rows.length,
          applied: true,
          committedAt: syncTimestamp,
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
        commitTokenSnapshot: async ({ rows, syncTimestamp }) => ({
          rowCount: rows.length,
          applied: true,
          committedAt: syncTimestamp,
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
        commitTokenSnapshot: async () => ({
          rowCount: 0,
          applied: false,
          committedAt: 19,
        }),
      },
      now: () => 20,
    });

    expect(await coordinator.sync(request)).toMatchObject({
      outcome: 'complete',
      addresses: [
        {
          outcome: 'complete',
          committedRowCount: 0,
          committedAt: 19,
          superseded: true,
        },
      ],
    });
  });

  it('emits one address completion as soon as each address settles', async () => {
    const onAddressCompletion = jest.fn();
    const coordinator = createTokenAssetSyncCoordinator({
      api: {
        usedChainList: async address => [{ id: address.slice(-1) }],
        listToken: async (_address, chain) => [{ id: chain, chain }],
      },
      persistence: {
        commitTokenSnapshot: async ({ rows, syncTimestamp }) => ({
          rowCount: rows.length,
          applied: true,
          committedAt: syncTimestamp,
        }),
      },
      onAddressCompletion,
    });

    const receipt = await coordinator.sync({
      ...request,
      addresses: ['0x1', '0x2'],
    });

    expect(onAddressCompletion).toHaveBeenCalledTimes(2);
    expect(
      onAddressCompletion.mock.calls.map(([value]) => value.address),
    ).toEqual(expect.arrayContaining(['0x1', '0x2']));
    expect(receipt.addresses).toHaveLength(2);
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
