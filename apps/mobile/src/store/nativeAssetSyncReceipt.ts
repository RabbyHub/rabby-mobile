export const NATIVE_ASSET_SYNC_KINDS = ['token', 'protocol', 'nft'] as const;

export type NativeAssetSyncKind = (typeof NATIVE_ASSET_SYNC_KINDS)[number];
export type NativeAssetReplacementScope = 'address' | 'chains';
export type NativeAssetSyncOutcome = 'complete' | 'partial' | 'failed';

export type NativeAssetSyncCompletion = Readonly<{
  schemaVersion: 2;
  requestId: string;
  kind: NativeAssetSyncKind;
  success: boolean;
  outcome: NativeAssetSyncOutcome;
  address: string;
  generation: number;
  committedAt: number;
  replacementScope: NativeAssetReplacementScope;
  chainIds: string[];
  failedChainIds: string[];
  committedRowCount: number;
  stage: string;
  error: string;
}>;

type NativeAssetSyncHandler = (
  completion: NativeAssetSyncCompletion,
) => void | Promise<void>;

type CompletionEntry = {
  createdAt: number;
  promise: Promise<NativeAssetSyncCompletion>;
};

type CommitApplicationEntry = {
  createdAt: number;
  promise: Promise<void>;
};

type CompletionWaiter = {
  resolve(completion: NativeAssetSyncCompletion): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const COMPLETION_RETENTION_MS = 5 * 60_000;
const MAX_RETAINED_COMPLETIONS = 256;

const handlers = new Map<NativeAssetSyncKind, NativeAssetSyncHandler>();
const completions = new Map<string, CompletionEntry>();
const commitApplications = new Map<string, CommitApplicationEntry>();
const waiters = new Map<string, Set<CompletionWaiter>>();

const asRecord = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Native asset sync completion must be an object');
  }
  return input as Record<string, unknown>;
};

const readString = (
  record: Record<string, unknown>,
  key: string,
  allowEmpty = false,
) => {
  const value = record[key];
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new Error(`Native asset sync completion has invalid ${key}`);
  }
  return value;
};

const readInteger = (
  record: Record<string, unknown>,
  key: string,
  minimum = 0,
) => {
  const value = record[key];
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new Error(`Native asset sync completion has invalid ${key}`);
  }
  return value;
};

const isNativeAssetSyncKind = (value: unknown): value is NativeAssetSyncKind =>
  NATIVE_ASSET_SYNC_KINDS.includes(value as NativeAssetSyncKind);

const isNativeAssetSyncOutcome = (
  value: unknown,
): value is NativeAssetSyncOutcome =>
  value === 'complete' || value === 'partial' || value === 'failed';

export const normalizeNativeAssetSyncCompletion = (
  input: unknown,
): NativeAssetSyncCompletion => {
  const record = asRecord(input);
  if (record.schemaVersion !== 2) {
    throw new Error('Native asset sync completion schema is unsupported');
  }
  if (!isNativeAssetSyncKind(record.kind)) {
    throw new Error('Native asset sync completion kind is unsupported');
  }
  if (typeof record.success !== 'boolean') {
    throw new Error('Native asset sync completion has invalid success');
  }
  if (!isNativeAssetSyncOutcome(record.outcome)) {
    throw new Error('Native asset sync completion has invalid outcome');
  }
  if (record.success !== (record.outcome !== 'failed')) {
    throw new Error('Native asset sync completion outcome is inconsistent');
  }
  if (
    record.replacementScope !== 'address' &&
    record.replacementScope !== 'chains'
  ) {
    throw new Error(
      'Native asset sync completion has invalid replacementScope',
    );
  }
  if (
    !Array.isArray(record.chainIds) ||
    record.chainIds.some(chainId => typeof chainId !== 'string' || !chainId)
  ) {
    throw new Error('Native asset sync completion has invalid chainIds');
  }
  if (
    !Array.isArray(record.failedChainIds) ||
    record.failedChainIds.some(
      chainId => typeof chainId !== 'string' || !chainId,
    )
  ) {
    throw new Error('Native asset sync completion has invalid failedChainIds');
  }
  if (
    record.kind !== 'token' &&
    (record.replacementScope !== 'address' ||
      record.chainIds.length > 0 ||
      record.failedChainIds.length > 0 ||
      record.outcome === 'partial')
  ) {
    throw new Error(
      `Native ${record.kind} sync completion must replace one address`,
    );
  }
  if (
    record.outcome === 'partial' &&
    (record.kind !== 'token' ||
      record.replacementScope !== 'chains' ||
      record.chainIds.length === 0 ||
      record.failedChainIds.length === 0)
  ) {
    throw new Error('Partial native token sync completion is invalid');
  }

  const committedAt = readInteger(record, 'committedAt');
  if (record.success && committedAt === 0) {
    throw new Error(
      'Successful native asset sync completion must include committedAt',
    );
  }

  return Object.freeze({
    schemaVersion: 2,
    requestId: readString(record, 'requestId'),
    kind: record.kind,
    success: record.success,
    outcome: record.outcome,
    address: readString(record, 'address').toLowerCase(),
    generation: readInteger(record, 'generation'),
    committedAt,
    replacementScope: record.replacementScope,
    chainIds: Array.from(new Set(record.chainIds)),
    failedChainIds: Array.from(new Set(record.failedChainIds)),
    committedRowCount: readInteger(record, 'committedRowCount'),
    stage: readString(record, 'stage'),
    error: readString(record, 'error', true),
  });
};

const getCommitKey = (completion: NativeAssetSyncCompletion) =>
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
  for (const [requestId, entry] of completions) {
    if (entry.createdAt < expiredBefore) {
      completions.delete(requestId);
    }
  }
  for (const [key, entry] of commitApplications) {
    if (entry.createdAt < expiredBefore) {
      commitApplications.delete(key);
    }
  }
  while (completions.size > MAX_RETAINED_COMPLETIONS) {
    const oldestRequestId = completions.keys().next().value;
    if (!oldestRequestId) {
      break;
    }
    completions.delete(oldestRequestId);
  }
};

const applyCommittedSnapshot = (completion: NativeAssetSyncCompletion) => {
  const handler = handlers.get(completion.kind);
  if (!handler) {
    return Promise.reject(
      new Error(
        `No native asset sync handler registered for ${completion.kind}`,
      ),
    );
  }

  const commitKey = getCommitKey(completion);
  const existing = commitApplications.get(commitKey);
  if (existing) {
    return existing.promise;
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

const createCompletionError = (completion: NativeAssetSyncCompletion) =>
  new Error(
    `Native ${completion.kind} sync ${completion.requestId} failed at ${
      completion.stage
    }: ${completion.error || 'unknown error'}`,
  );

export const dispatchNativeAssetSyncCompletion = (input: unknown) => {
  pruneRetainedEntries();
  const completion = normalizeNativeAssetSyncCompletion(input);
  const retained = completions.get(completion.requestId);
  if (retained) {
    return retained.promise;
  }

  const promise = (
    completion.success ? applyCommittedSnapshot(completion) : Promise.resolve()
  ).then(() => {
    if (!completion.success) {
      throw createCompletionError(completion);
    }
    return completion;
  });
  completions.set(completion.requestId, {
    createdAt: Date.now(),
    promise,
  });

  const activeWaiters = waiters.get(completion.requestId);
  if (activeWaiters) {
    waiters.delete(completion.requestId);
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

export const waitForNativeAssetSyncCompletion = (
  requestId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) => {
  if (!requestId || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error('Native asset sync wait input is invalid'));
  }
  pruneRetainedEntries();
  const retained = completions.get(requestId);
  if (retained) {
    return retained.promise;
  }

  return new Promise<NativeAssetSyncCompletion>((resolve, reject) => {
    const requestWaiters =
      waiters.get(requestId) || new Set<CompletionWaiter>();
    const waiter: CompletionWaiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        requestWaiters.delete(waiter);
        if (!requestWaiters.size) {
          waiters.delete(requestId);
        }
        reject(
          new Error(
            `Timed out waiting for native asset sync request ${requestId}`,
          ),
        );
      }, timeoutMs),
    };
    requestWaiters.add(waiter);
    waiters.set(requestId, requestWaiters);
  });
};

export const registerNativeAssetSyncHandler = (
  kind: NativeAssetSyncKind,
  handler: NativeAssetSyncHandler,
) => {
  handlers.set(kind, handler);
  return () => {
    if (handlers.get(kind) === handler) {
      handlers.delete(kind);
    }
  };
};

export const resetNativeAssetSyncReceiptsForTests = () => {
  handlers.clear();
  completions.clear();
  commitApplications.clear();
  waiters.forEach(requestWaiters => {
    requestWaiters.forEach(waiter => clearTimeout(waiter.timer));
  });
  waiters.clear();
};
