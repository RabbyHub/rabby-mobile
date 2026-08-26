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
    address: string;
    syncTimestamp: number;
    rows: TokenCacheRow[];
  }): Promise<{ rowCount: number; applied: boolean }>;
};

type CoordinatorOptions = {
  api: TokenAssetApi;
  persistence: TokenSnapshotPersistence;
  now?: () => number;
  addressConcurrency?: number;
  chainConcurrency?: number;
  isCancelled?: (requestId: string) => boolean;
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

/** Create the isolated token synchronization coordinator. */
export function createTokenAssetSyncCoordinator({
  api,
  persistence,
  now = Date.now,
  addressConcurrency = 6,
  chainConcurrency = 15,
  isCancelled = () => false,
}: CoordinatorOptions) {
  const inFlight = new Map<string, Promise<TokenAssetSyncReceipt>>();
  const runChainRequest = createConcurrencyLimiter(chainConcurrency);

  const syncAddress = async (
    request: TokenAssetSyncRequest,
    rawAddress: string,
  ): Promise<TokenAddressSyncReceipt> => {
    const address = rawAddress.toLowerCase();
    if (isCancelled(request.requestId)) {
      return {
        address,
        outcome: 'cancelled',
        chainIds: [],
        failedChainIds: [],
        committedRowCount: 0,
      };
    }

    let chainIds: string[] = [];
    try {
      chainIds = Array.from(
        new Set((await api.usedChainList(address)).map(chain => chain.id)),
      ).filter(Boolean);
    } catch (error) {
      return {
        address,
        outcome: 'failed',
        chainIds,
        failedChainIds: [],
        committedRowCount: 0,
        errorCode: errorCode(error),
      };
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
      return {
        address,
        outcome: 'cancelled',
        chainIds,
        failedChainIds,
        committedRowCount: 0,
      };
    }

    // Never replace an address-wide snapshot with an incomplete chain set.
    if (failedChainIds.length) {
      return {
        address,
        outcome: 'partial',
        chainIds,
        failedChainIds,
        committedRowCount: 0,
        errorCode: 'asset_sync_partial_chain_failure',
      };
    }

    const tokens = chainResults.flatMap(result =>
      result.status === 'fulfilled' ? result.value.tokens : [],
    );
    const syncTimestamp = request.issuedAt;
    try {
      const commit = await persistence.commitTokenSnapshot({
        address,
        syncTimestamp,
        rows: makeTokenCacheRows(address, tokens, syncTimestamp),
      });
      return {
        address,
        outcome: 'complete',
        chainIds,
        failedChainIds: [],
        committedRowCount: commit.rowCount,
        ...(commit.applied
          ? { committedAt: syncTimestamp }
          : { superseded: true }),
      };
    } catch (error) {
      return {
        address,
        outcome: 'failed',
        chainIds,
        failedChainIds: [],
        committedRowCount: 0,
        errorCode: errorCode(error),
      };
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
    const receipts = (
      await mapWithConcurrency(addresses, addressConcurrency, address =>
        syncAddress(request, address),
      )
    ).map((result, index) =>
      result.status === 'fulfilled'
        ? result.value
        : ({
            address: addresses[index],
            outcome: 'failed',
            chainIds: [],
            failedChainIds: [],
            committedRowCount: 0,
            errorCode: errorCode(result.reason),
          } satisfies TokenAddressSyncReceipt),
    );
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
