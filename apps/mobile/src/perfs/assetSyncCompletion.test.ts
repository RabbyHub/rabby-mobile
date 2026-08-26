import {
  ASSET_SYNC_WORKER_SCHEMA_VERSION,
  type AssetSyncCompletion,
} from '@rabby-wallet/asset-sync-worker-core';

import {
  AssetSyncCompletionError,
  dispatchAssetSyncCompletion,
  registerAssetSyncCompletionHandler,
  resetAssetSyncCompletionsForTests,
  waitForAssetSyncCompletion,
} from './assetSyncCompletion';

const makeCompletion = (
  overrides: Partial<AssetSyncCompletion> = {},
): AssetSyncCompletion => ({
  schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
  requestId: 'request-1',
  kind: 'token',
  success: true,
  address: '0xabc',
  outcome: 'complete',
  generation: 10,
  committedAt: 10,
  replacementScope: 'address',
  chainIds: ['eth'],
  failedChainIds: [],
  committedRowCount: 1,
  superseded: false,
  stage: 'committed',
  errorCode: '',
  ...overrides,
});

describe('asset sync completions', () => {
  afterEach(() => {
    resetAssetSyncCompletionsForTests();
    jest.useRealTimers();
  });

  it('retains an event that arrives before its waiter', async () => {
    const handler = jest.fn();
    registerAssetSyncCompletionHandler('token', handler);
    const completion = makeCompletion();

    await dispatchAssetSyncCompletion(completion);

    await expect(
      waitForAssetSyncCompletion({
        requestId: completion.requestId,
        kind: completion.kind,
        address: completion.address,
      }),
    ).resolves.toMatchObject({ address: '0xabc' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('applies a duplicated completion exactly once', async () => {
    const handler = jest.fn();
    registerAssetSyncCompletionHandler('token', handler);
    const completion = makeCompletion();

    await Promise.all([
      dispatchAssetSyncCompletion(completion),
      dispatchAssetSyncCompletion({ ...completion }),
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('allows a failed Store application to be retried', async () => {
    const handler = jest
      .fn()
      .mockRejectedValueOnce(new Error('store temporarily unavailable'))
      .mockResolvedValueOnce(undefined);
    registerAssetSyncCompletionHandler('token', handler);
    const completion = makeCompletion();

    await expect(dispatchAssetSyncCompletion(completion)).rejects.toThrow(
      'store temporarily unavailable',
    );
    await expect(dispatchAssetSyncCompletion(completion)).resolves.toEqual(
      completion,
    );

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('keeps different addresses distinct within one aggregate request', async () => {
    const handler = jest.fn();
    registerAssetSyncCompletionHandler('token', handler);

    await Promise.all([
      dispatchAssetSyncCompletion(makeCompletion({ address: '0x1' })),
      dispatchAssetSyncCompletion(makeCompletion({ address: '0x2' })),
    ]);

    expect(handler.mock.calls.map(([value]) => value.address)).toEqual([
      '0x1',
      '0x2',
    ]);
  });

  it('applies a partial chain commit before exposing its receipt', async () => {
    const handler = jest.fn();
    registerAssetSyncCompletionHandler('token', handler);

    await expect(
      dispatchAssetSyncCompletion(
        makeCompletion({
          outcome: 'partial',
          replacementScope: 'chains',
          chainIds: ['eth'],
          failedChainIds: ['arb'],
          errorCode: 'asset_sync_partial_chain_failure',
        }),
      ),
    ).resolves.toMatchObject({
      outcome: 'partial',
      chainIds: ['eth'],
      failedChainIds: ['arb'],
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects failed completions without applying a snapshot', async () => {
    const handler = jest.fn();
    registerAssetSyncCompletionHandler('token', handler);

    await expect(
      dispatchAssetSyncCompletion(
        makeCompletion({
          success: false,
          outcome: 'failed',
          committedAt: 0,
          chainIds: [],
          committedRowCount: 0,
          stage: 'chain-fetch',
          errorCode: 'asset_sync_all_chains_failed',
        }),
      ),
    ).rejects.toBeInstanceOf(AssetSyncCompletionError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('still applies a late completion after an earlier waiter times out', async () => {
    jest.useFakeTimers();
    const handler = jest.fn();
    registerAssetSyncCompletionHandler('token', handler);
    const completion = makeCompletion();
    const wait = waitForAssetSyncCompletion(
      {
        requestId: completion.requestId,
        kind: completion.kind,
        address: completion.address,
      },
      10,
    );

    jest.advanceTimersByTime(10);
    await expect(wait).rejects.toThrow('Timed out waiting for asset sync');
    await dispatchAssetSyncCompletion(completion);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
