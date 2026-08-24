import { create as zCreate } from 'zustand';
import { mutative as zMutative } from 'zustand-mutative';

import type { AssetProjectionIdentity } from './assetProjectionIdentity';
import { buildAssetProjectionStorageKey } from './assetProjectionIdentity';

export type AssetReadModelPhase =
  | 'uninitialized'
  | 'restoring'
  | 'ready'
  | 'refreshing'
  | 'stale'
  | 'error';

export type AssetReadModelSource =
  | 'none'
  | 'memory'
  | 'database'
  | 'remote'
  | 'native';

export type AssetReadModelEntry = AssetProjectionIdentity & {
  phase: AssetReadModelPhase;
  source: AssetReadModelSource;
  hasSnapshot: boolean;
  hasData: boolean;
  sourceComplete: boolean;
  rowCount: number;
  revision: number;
  generation?: number;
  committedAt?: number;
  committedRequestId?: string;
  activeRequestId?: string;
  lastError?: string;
};

type AssetReadModelState = {
  entries: Record<string, AssetReadModelEntry>;
};

type PublishAssetReadModelInput = {
  source: Exclude<AssetReadModelSource, 'none'>;
  rowCount: number;
  sourceComplete: boolean;
  generation?: number;
  committedAt?: number;
  committedRequestId?: string;
  requestId?: string;
};

const createEntry = (
  identity: AssetProjectionIdentity,
): AssetReadModelEntry => ({
  ...identity,
  phase: 'uninitialized',
  source: 'none',
  hasSnapshot: false,
  hasData: false,
  sourceComplete: false,
  rowCount: 0,
  revision: 0,
});

const getEntryKey = (identity: AssetProjectionIdentity) =>
  buildAssetProjectionStorageKey(identity);

export const useAssetReadModelStore = zCreate(
  zMutative<AssetReadModelState>(() => ({
    entries: {},
  })),
);

export const ensureAssetReadModel = (identity: AssetProjectionIdentity) => {
  const key = getEntryKey(identity);
  const existing = useAssetReadModelStore.getState().entries[key];
  if (existing) {
    return existing;
  }

  const entry = createEntry(identity);
  useAssetReadModelStore.setState(draft => {
    draft.entries[key] = entry;
  });
  return useAssetReadModelStore.getState().entries[key]!;
};

export const getAssetReadModel = (identity: AssetProjectionIdentity) =>
  useAssetReadModelStore.getState().entries[getEntryKey(identity)] ||
  ensureAssetReadModel(identity);

export const beginAssetReadModelRestore = (
  identity: AssetProjectionIdentity,
) => {
  const key = getEntryKey(identity);
  ensureAssetReadModel(identity);
  useAssetReadModelStore.setState(draft => {
    const entry = draft.entries[key]!;
    if (!entry.hasSnapshot) {
      entry.phase = 'restoring';
    }
    entry.lastError = undefined;
  });
};

export const beginAssetReadModelRefresh = (
  identity: AssetProjectionIdentity,
  requestId: string,
) => {
  const key = getEntryKey(identity);
  ensureAssetReadModel(identity);
  useAssetReadModelStore.setState(draft => {
    const entry = draft.entries[key]!;
    entry.phase = 'refreshing';
    entry.activeRequestId = requestId;
    entry.lastError = undefined;
  });
};

export const publishAssetReadModel = (
  identity: AssetProjectionIdentity,
  input: PublishAssetReadModelInput,
) => {
  const key = getEntryKey(identity);
  ensureAssetReadModel(identity);
  let published = false;

  useAssetReadModelStore.setState(draft => {
    const entry = draft.entries[key]!;
    if (input.requestId && input.requestId !== entry.activeRequestId) {
      return;
    }

    const rowCount = Math.max(0, Math.floor(input.rowCount));
    const hasSnapshot = rowCount > 0 || input.sourceComplete;
    const hasData = rowCount > 0;
    const generation = input.generation ?? entry.generation;
    const committedAt = input.committedAt ?? entry.committedAt;
    const committedRequestId =
      input.committedRequestId ?? entry.committedRequestId;
    const snapshotChanged =
      entry.source !== input.source ||
      entry.hasSnapshot !== hasSnapshot ||
      entry.hasData !== hasData ||
      entry.sourceComplete !== input.sourceComplete ||
      entry.rowCount !== rowCount ||
      entry.generation !== generation ||
      entry.committedAt !== committedAt ||
      entry.committedRequestId !== committedRequestId;
    const hasActiveRefresh =
      !!entry.activeRequestId && input.requestId === undefined;

    if (
      !snapshotChanged &&
      entry.phase === 'ready' &&
      entry.activeRequestId === undefined &&
      entry.lastError === undefined
    ) {
      published = true;
      return;
    }

    entry.phase = hasActiveRefresh ? 'refreshing' : 'ready';
    entry.source = input.source;
    entry.hasSnapshot = hasSnapshot;
    entry.hasData = hasData;
    entry.sourceComplete = input.sourceComplete;
    entry.rowCount = rowCount;
    if (snapshotChanged) {
      entry.revision += 1;
    }
    entry.generation = generation;
    entry.committedAt = committedAt;
    entry.committedRequestId = committedRequestId;
    if (!hasActiveRefresh) {
      entry.activeRequestId = undefined;
    }
    entry.lastError = undefined;
    published = true;
  });

  return published;
};

export const failAssetReadModel = (
  identity: AssetProjectionIdentity,
  error: unknown,
  requestId?: string,
) => {
  const key = getEntryKey(identity);
  ensureAssetReadModel(identity);
  let applied = false;

  useAssetReadModelStore.setState(draft => {
    const entry = draft.entries[key]!;
    if (requestId && requestId !== entry.activeRequestId) {
      return;
    }

    entry.phase = entry.hasSnapshot ? 'stale' : 'error';
    entry.activeRequestId = undefined;
    entry.lastError = error instanceof Error ? error.message : String(error);
    applied = true;
  });

  return applied;
};

export const resetAssetReadModels = () => {
  useAssetReadModelStore.setState({ entries: {} });
};
