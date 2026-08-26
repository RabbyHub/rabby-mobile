import {
  normalizeAssetSyncCompletion,
  type AssetSyncCompletion,
  type AssetSyncKind,
} from '@rabby-wallet/asset-sync-worker-core';

type AssetSyncCompletionHandler = (
  completion: AssetSyncCompletion,
) => void | Promise<void>;

type CompletionEntry = {
  createdAt: number;
  promise: Promise<AssetSyncCompletion>;
};

type CommitApplicationEntry = {
  createdAt: number;
  promise: Promise<void>;
};

type CompletionWaiter = {
  resolve(completion: AssetSyncCompletion): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
};

export type AssetSyncCompletionIdentity = Pick<
  AssetSyncCompletion,
  'requestId' | 'kind' | 'address'
>;

const DEFAULT_TIMEOUT_MS = 120_000;
const COMPLETION_RETENTION_MS = 5 * 60_000;
const MAX_RETAINED_COMPLETIONS = 512;

const handlers = new Map<AssetSyncKind, AssetSyncCompletionHandler>();
const completions = new Map<string, CompletionEntry>();
const commitApplications = new Map<string, CommitApplicationEntry>();
const waiters = new Map<string, Set<CompletionWaiter>>();

const getCompletionKey = (identity: AssetSyncCompletionIdentity) =>
  [identity.requestId, identity.kind, identity.address.toLowerCase()].join(':');

const getCommitKey = (completion: AssetSyncCompletion) =>
  [
    completion.kind,
    completion.address,
    completion.generation,
    completion.committedAt,
    completion.replacementScope,
    [...completion.chainIds].sort().join(','),
  ].join(':');

const pruneRetainedEntries = () => {
  const expiredBefore = Date.now() - COMPLETION_RETENTION_MS;
  for (const [key, entry] of completions) {
    if (entry.createdAt < expiredBefore) {
      completions.delete(key);
    }
  }
  for (const [key, entry] of commitApplications) {
    if (entry.createdAt < expiredBefore) {
      commitApplications.delete(key);
    }
  }
  while (completions.size > MAX_RETAINED_COMPLETIONS) {
    const oldestKey = completions.keys().next().value;
    if (!oldestKey) {
      break;
    }
    completions.delete(oldestKey);
  }
};

const applyCommittedSnapshot = (completion: AssetSyncCompletion) => {
  const handler = handlers.get(completion.kind);
  if (!handler) {
    return Promise.reject(
      new Error(`No asset sync handler registered for ${completion.kind}`),
    );
  }

  const commitKey = getCommitKey(completion);
  const retained = commitApplications.get(commitKey);
  if (retained) {
    return retained.promise;
  }

  const promise = Promise.resolve()
    .then(() => handler(completion))
    .catch(error => {
      commitApplications.delete(commitKey);
      throw error;
    });
  commitApplications.set(commitKey, { createdAt: Date.now(), promise });
  return promise;
};

export class AssetSyncCompletionError extends Error {
  readonly completion: AssetSyncCompletion;

  constructor(completion: AssetSyncCompletion) {
    super(
      `Asset sync ${completion.kind}/${completion.address} failed at ${
        completion.stage
      }: ${completion.errorCode || completion.outcome}`,
    );
    this.name = 'AssetSyncCompletionError';
    this.completion = completion;
  }
}

export const dispatchAssetSyncCompletion = (input: unknown) => {
  pruneRetainedEntries();
  const completion = normalizeAssetSyncCompletion(input);
  const completionKey = getCompletionKey(completion);
  const retained = completions.get(completionKey);
  if (retained) {
    return retained.promise;
  }

  let promise!: Promise<AssetSyncCompletion>;
  promise = (
    completion.success ? applyCommittedSnapshot(completion) : Promise.resolve()
  )
    .then(() => {
      if (!completion.success) {
        throw new AssetSyncCompletionError(completion);
      }
      return completion;
    })
    .catch(error => {
      if (completions.get(completionKey)?.promise === promise) {
        completions.delete(completionKey);
      }
      throw error;
    });
  completions.set(completionKey, { createdAt: Date.now(), promise });

  const activeWaiters = waiters.get(completionKey);
  if (activeWaiters) {
    waiters.delete(completionKey);
    promise.then(
      result => {
        activeWaiters.forEach(waiter => {
          clearTimeout(waiter.timer);
          waiter.resolve(result);
        });
      },
      error => {
        activeWaiters.forEach(waiter => {
          clearTimeout(waiter.timer);
          waiter.reject(error);
        });
      },
    );
  }

  promise.catch(() => undefined);
  return promise;
};

export const waitForAssetSyncCompletion = (
  identity: AssetSyncCompletionIdentity,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error('Asset sync wait timeout is invalid'));
  }
  pruneRetainedEntries();
  const completionKey = getCompletionKey(identity);
  const retained = completions.get(completionKey);
  if (retained) {
    return retained.promise;
  }

  return new Promise<AssetSyncCompletion>((resolve, reject) => {
    const requestWaiters =
      waiters.get(completionKey) || new Set<CompletionWaiter>();
    const waiter: CompletionWaiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        requestWaiters.delete(waiter);
        if (!requestWaiters.size) {
          waiters.delete(completionKey);
        }
        reject(
          new Error(
            `Timed out waiting for asset sync ${identity.requestId}/${identity.kind}/${identity.address}`,
          ),
        );
      }, timeoutMs),
    };
    requestWaiters.add(waiter);
    waiters.set(completionKey, requestWaiters);
  });
};

export const registerAssetSyncCompletionHandler = (
  kind: AssetSyncKind,
  handler: AssetSyncCompletionHandler,
) => {
  handlers.set(kind, handler);
  return () => {
    if (handlers.get(kind) === handler) {
      handlers.delete(kind);
    }
  };
};

export const hasAssetSyncCompletionHandler = (kind: AssetSyncKind) =>
  handlers.has(kind);

export const resetAssetSyncCompletionsForTests = () => {
  handlers.clear();
  completions.clear();
  commitApplications.clear();
  waiters.forEach(requestWaiters => {
    requestWaiters.forEach(waiter => clearTimeout(waiter.timer));
  });
  waiters.clear();
};
