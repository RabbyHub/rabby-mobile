/* eslint-disable jsdoc/require-param, jsdoc/require-returns */

import type {
  TokenAddressSyncReceipt,
  TokenAssetSyncReceipt,
  TokenAssetSyncRequest,
} from './protocol';
import {
  assertTokenAssetSyncRequest,
  ASSET_SYNC_WORKER_SCHEMA_VERSION,
} from './protocol';
import {
  makeTokenCacheRows,
  type TokenCacheRow,
  type WorkerTokenInput,
} from './tokenRows';

export type TokenAssetApi = {
  usedChainList(address: string): Promise<{ id: string }[]>;
  listToken(
    address: string,
    chainId: string,
    includeAll: boolean,
  ): Promise<WorkerTokenInput[]>;
};

export type TokenSnapshotPersistence = {
  commitTokenSnapshot(input: {
    requestId: string;
    address: string;
    syncTimestamp: number;
    replacementScope: 'address' | 'chains';
    chainIds: string[];
    failedChainIds: string[];
    rows: TokenCacheRow[];
  }): Promise<{ rowCount: number; applied: boolean; committedAt: number }>;
};

type CoordinatorOptions = {
  api: TokenAssetApi;
  persistence: TokenSnapshotPersistence;
  now?: () => number;
  addressConcurrency?: number;
  chainConcurrency?: number;
  isCancelled?: (requestId: string) => boolean;
  onAddressCompletion?: (receipt: TokenAddressSyncReceipt) => void;
};

/** Create a shared concurrency limiter for worker-side network requests. */
function createConcurrencyLimiter(concurrency: number) {
  const pending: (() => void)[] = [];
  let activeCount = 0;
  const limit = Math.max(1, concurrency);

  const acquire = () =>
    new Promise<void>(resolve => {
      const reserveAndResolve = () => {
        activeCount += 1;
        resolve();
      };
      if (activeCount < limit) {
        reserveAndResolve();
      } else {
        pending.push(reserveAndResolve);
      }
    });

  const release = () => {
    activeCount -= 1;
    pending.shift()?.();
  };

  return async <T>(task: () => Promise<T>) => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };
}

/** Map values concurrently while preserving their original result order. */
async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        try {
          results[index] = {
            status: 'fulfilled',
            value: await mapper(values[index]),
          };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    },
  );

  await Promise.all(workers);
  return results;
}

/** Aggregate address-level receipts into one request-level outcome. */
function aggregateOutcome(
  receipts: TokenAddressSyncReceipt[],
): TokenAssetSyncReceipt['outcome'] {
  if (receipts.every(receipt => receipt.outcome === 'cancelled')) {
    return 'cancelled';
  }
  if (receipts.every(receipt => receipt.outcome === 'complete')) {
    return 'complete';
  }
  if (receipts.every(receipt => receipt.outcome === 'failed')) {
    return 'failed';
  }
  return 'partial';
}

/** Convert an arbitrary worker failure into a bounded receipt error code. */
function errorCode(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 120);
  }
  return 'asset_sync_unknown_error';
}

function makeAddressReceipt(
  request: TokenAssetSyncRequest,
  input: Omit<
    TokenAddressSyncReceipt,
    'schemaVersion' | 'requestId' | 'kind' | 'generation'
  >,
): TokenAddressSyncReceipt {
  return {
    schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
    requestId: request.requestId,
    kind: 'token',
    generation: request.issuedAt,
    ...input,
  };
}

/** Create the isolated token synchronization coordinator. */
export function createTokenAssetSyncCoordinator({
  api,
  persistence,
  now = Date.now,
  addressConcurrency = 6,
  chainConcurrency = 15,
  isCancelled = () => false,
  onAddressCompletion = () => undefined,
}: CoordinatorOptions) {
  const inFlight = new Map<string, Promise<TokenAssetSyncReceipt>>();
  const runChainRequest = createConcurrencyLimiter(chainConcurrency);

  const syncAddress = async (
    request: TokenAssetSyncRequest,
    rawAddress: string,
  ): Promise<TokenAddressSyncReceipt> => {
    const address = rawAddress.toLowerCase();
    if (isCancelled(request.requestId)) {
      return makeAddressReceipt(request, {
        address,
        success: false,
        outcome: 'cancelled',
        committedAt: 0,
        replacementScope: 'address',
        chainIds: [],
        failedChainIds: [],
        committedRowCount: 0,
        superseded: false,
        stage: 'cancelled',
        errorCode: 'asset_sync_cancelled',
      });
    }

    let chainIds: string[] = [];
    try {
      chainIds = Array.from(
        new Set((await api.usedChainList(address)).map(chain => chain.id)),
      ).filter(Boolean);
    } catch (error) {
      return makeAddressReceipt(request, {
        address,
        success: false,
        outcome: 'failed',
        committedAt: 0,
        replacementScope: 'address',
        chainIds: [],
        failedChainIds: [],
        committedRowCount: 0,
        superseded: false,
        stage: 'used-chain-list',
        errorCode: errorCode(error),
      });
    }

    const chainResults = await mapWithConcurrency(
      chainIds,
      chainIds.length || 1,
      async chainId => ({
        chainId,
        tokens: await runChainRequest(async () => {
          if (isCancelled(request.requestId)) {
            throw new Error('asset_sync_cancelled');
          }
          return api.listToken(address, chainId, true);
        }),
      }),
    );
    const failedChainIds = chainResults.flatMap((result, index) =>
      result.status === 'rejected' ? [chainIds[index]] : [],
    );

    if (isCancelled(request.requestId)) {
      return makeAddressReceipt(request, {
        address,
        success: false,
        outcome: 'cancelled',
        committedAt: 0,
        replacementScope: 'address',
        chainIds: [],
        failedChainIds,
        committedRowCount: 0,
        superseded: false,
        stage: 'cancelled',
        errorCode: 'asset_sync_cancelled',
      });
    }

    const fulfilledChainSnapshots = chainResults.flatMap(result =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const successfulChainIds = fulfilledChainSnapshots.map(
      snapshot => snapshot.chainId,
    );

    if (failedChainIds.length && !successfulChainIds.length) {
      return makeAddressReceipt(request, {
        address,
        success: false,
        outcome: 'failed',
        committedAt: 0,
        replacementScope: 'chains',
        chainIds: [],
        failedChainIds,
        committedRowCount: 0,
        superseded: false,
        stage: 'chain-fetch',
        errorCode: 'asset_sync_all_chains_failed',
      });
    }

    const tokens = fulfilledChainSnapshots.flatMap(snapshot => snapshot.tokens);
    const syncTimestamp = request.issuedAt;
    const replacementScope = failedChainIds.length ? 'chains' : 'address';
    try {
      const commit = await persistence.commitTokenSnapshot({
        requestId: request.requestId,
        address,
        syncTimestamp,
        replacementScope,
        chainIds: successfulChainIds,
        failedChainIds,
        rows: makeTokenCacheRows(address, tokens, syncTimestamp, {
          includeEmptySentinel: replacementScope === 'address',
        }),
      });
      return makeAddressReceipt(request, {
        address,
        success: true,
        outcome: failedChainIds.length ? 'partial' : 'complete',
        committedAt: commit.committedAt,
        replacementScope,
        chainIds: successfulChainIds,
        failedChainIds,
        committedRowCount: commit.rowCount,
        superseded: !commit.applied,
        stage: commit.applied ? 'committed' : 'superseded',
        errorCode: failedChainIds.length
          ? 'asset_sync_partial_chain_failure'
          : '',
      });
    } catch (error) {
      return makeAddressReceipt(request, {
        address,
        success: false,
        outcome: 'failed',
        committedAt: 0,
        replacementScope,
        chainIds: [],
        failedChainIds: chainIds,
        committedRowCount: 0,
        superseded: false,
        stage: 'commit',
        errorCode: errorCode(error),
      });
    }
  };

  const execute = async (
    request: TokenAssetSyncRequest,
  ): Promise<TokenAssetSyncReceipt> => {
    assertTokenAssetSyncRequest(request);
    const startedAt = now();
    const addresses = Array.from(
      new Set(request.addresses.map(address => address.toLowerCase())),
    ).filter(Boolean);
    const settleAddress = async (address: string) => {
      let receipt: TokenAddressSyncReceipt;
      try {
        receipt = await syncAddress(request, address);
      } catch (error) {
        receipt = makeAddressReceipt(request, {
          address,
          success: false,
          outcome: 'failed',
          committedAt: 0,
          replacementScope: 'address',
          chainIds: [],
          failedChainIds: [],
          committedRowCount: 0,
          superseded: false,
          stage: 'coordinator',
          errorCode: errorCode(error),
        });
      }
      try {
        onAddressCompletion(receipt);
      } catch {
        // Completion delivery is redundant with the aggregate response.
      }
      return receipt;
    };
    const receipts = (
      await mapWithConcurrency(addresses, addressConcurrency, settleAddress)
    ).map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      throw result.reason;
    });
    return {
      schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
      requestId: request.requestId,
      kind: 'token',
      outcome: aggregateOutcome(receipts),
      startedAt,
      finishedAt: now(),
      addresses: receipts,
    };
  };

  return {
    sync(request: TokenAssetSyncRequest) {
      const existing = inFlight.get(request.requestId);
      if (existing) {
        return existing;
      }
      const pending = execute(request).finally(() => {
        inFlight.delete(request.requestId);
      });
      inFlight.set(request.requestId, pending);
      return pending;
    },
  };
}
