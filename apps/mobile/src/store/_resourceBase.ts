import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  ObservableResourceMeta,
  ObservableResourcePersistStatus,
  ObservableResourceStore,
} from './_resourceFlow';

export type ResourceFlowState = {
  hasValue: boolean;
  isHydrating: boolean;
  isFetchingRemote: boolean;
  isLoading: boolean;
  isLoadingWithoutValue: boolean;
  isRefreshing: boolean;
  persistStatus: ObservableResourcePersistStatus;
  lastError?: ObservableResourceMeta['lastError'];
};

export type ResourceFamilyFlowState = {
  resourceKeys: string[];
  loadingResourceKeys: string[];
  missingResourceKeys: string[];
  hasAnyValue: boolean;
  isAnyLoading: boolean;
  isAnyLoadingWithoutValue: boolean;
  hasAllValues: boolean;
};

export type ResourceSnapshot<TValue> = {
  resourceKey: string;
  value?: TValue;
  flow: ResourceFlowState;
  sourceOfCurrentValue?: ObservableResourceMeta['sourceOfCurrentValue'];
  persistStatus: ResourceFlowState['persistStatus'];
};

function normalizeResourceKeys(resourceKeys: string[]) {
  return Array.from(new Set(resourceKeys.filter(Boolean)));
}

function buildResourceSnapshots<TValue>(
  resourceKeys: string[],
  valueMap: Record<string, TValue>,
  metaMap: Record<string, ObservableResourceMeta>,
): ResourceSnapshot<TValue>[] {
  return normalizeResourceKeys(resourceKeys).map(resourceKey => {
    const meta = metaMap[resourceKey];

    return {
      resourceKey,
      value: valueMap[resourceKey],
      flow: buildResourceFlowState(meta),
      sourceOfCurrentValue: meta?.sourceOfCurrentValue,
      persistStatus: meta?.persistStatus || 'idle',
    } satisfies ResourceSnapshot<TValue>;
  });
}

function buildResourceSnapshotsFromSelectedEntries<TValue>(
  resourceKeys: string[],
  valueList: Array<TValue | undefined>,
  metaList: Array<ObservableResourceMeta | undefined>,
): ResourceSnapshot<TValue>[] {
  return normalizeResourceKeys(resourceKeys).map((resourceKey, index) => {
    const meta = metaList[index];

    return {
      resourceKey,
      value: valueList[index],
      flow: buildResourceFlowState(meta),
      sourceOfCurrentValue: meta?.sourceOfCurrentValue,
      persistStatus: meta?.persistStatus || 'idle',
    } satisfies ResourceSnapshot<TValue>;
  });
}

export function buildResourceFlowState(
  meta?: ObservableResourceMeta,
): ResourceFlowState {
  const hasValue = !!meta?.hasValue;
  const isHydrating = !!meta?.isHydrating;
  const isFetchingRemote = !!meta?.isFetchingRemote;
  const isLoading = isHydrating || isFetchingRemote;

  return {
    hasValue,
    isHydrating,
    isFetchingRemote,
    isLoading,
    isLoadingWithoutValue: !hasValue && isLoading,
    isRefreshing: hasValue && isLoading,
    persistStatus: meta?.persistStatus || 'idle',
    lastError: meta?.lastError,
  };
}

export function buildResourceFamilyFlowState(
  resourceKeys: string[],
  metaMap: Record<string, ObservableResourceMeta>,
): ResourceFamilyFlowState {
  const normalized = Array.from(new Set(resourceKeys.filter(Boolean)));
  const loadingResourceKeys: string[] = [];
  const missingResourceKeys: string[] = [];

  normalized.forEach(resourceKey => {
    const flow = buildResourceFlowState(metaMap[resourceKey]);
    if (!flow.hasValue) {
      missingResourceKeys.push(resourceKey);
    }
    if (flow.isLoading) {
      loadingResourceKeys.push(resourceKey);
    }
  });

  return {
    resourceKeys: normalized,
    loadingResourceKeys,
    missingResourceKeys,
    hasAnyValue: normalized.some(resourceKey => {
      return buildResourceFlowState(metaMap[resourceKey]).hasValue;
    }),
    isAnyLoading: loadingResourceKeys.length > 0,
    isAnyLoadingWithoutValue: normalized.some(resourceKey => {
      return buildResourceFlowState(metaMap[resourceKey]).isLoadingWithoutValue;
    }),
    hasAllValues: normalized.length > 0 && missingResourceKeys.length === 0,
  };
}

function buildResourceFamilyFlowStateFromSelectedEntries(
  resourceKeys: string[],
  metaList: Array<ObservableResourceMeta | undefined>,
): ResourceFamilyFlowState {
  const normalized = normalizeResourceKeys(resourceKeys);
  const loadingResourceKeys: string[] = [];
  const missingResourceKeys: string[] = [];

  normalized.forEach((resourceKey, index) => {
    const flow = buildResourceFlowState(metaList[index]);
    if (!flow.hasValue) {
      missingResourceKeys.push(resourceKey);
    }
    if (flow.isLoading) {
      loadingResourceKeys.push(resourceKey);
    }
  });

  return {
    resourceKeys: normalized,
    loadingResourceKeys,
    missingResourceKeys,
    hasAnyValue: normalized.some((_, index) => {
      return buildResourceFlowState(metaList[index]).hasValue;
    }),
    isAnyLoading: loadingResourceKeys.length > 0,
    isAnyLoadingWithoutValue: normalized.some((_, index) => {
      return buildResourceFlowState(metaList[index]).isLoadingWithoutValue;
    }),
    hasAllValues: normalized.length > 0 && missingResourceKeys.length === 0,
  };
}

export class ResourceBaseStore<TValue> extends ObservableResourceStore<TValue> {
  getFlowState = (resourceKey?: string) => {
    return buildResourceFlowState(this.getMeta(resourceKey));
  };

  useFlowState = (resourceKey?: string) => {
    const meta = this.useMeta(resourceKey);

    return useMemo(() => buildResourceFlowState(meta), [meta]);
  };

  getFamilyFlowState = (resourceKeys: string[]) => {
    return buildResourceFamilyFlowState(resourceKeys, this.getMetaMap());
  };

  getSnapshots = (resourceKeys: string[]) => {
    const state = this.getState();

    return buildResourceSnapshots(resourceKeys, state.valueMap, state.metaMap);
  };

  useFamilyFlowState = (resourceKeys: string[]) => {
    const normalizedResourceKeys = useMemo(
      () => normalizeResourceKeys(resourceKeys),
      [resourceKeys],
    );
    const metaList = this.useStore(
      useShallow(state => {
        return normalizedResourceKeys.map(resourceKey => {
          return state.metaMap[resourceKey];
        });
      }),
    );

    return useMemo(() => {
      return buildResourceFamilyFlowStateFromSelectedEntries(
        normalizedResourceKeys,
        metaList,
      );
    }, [metaList, normalizedResourceKeys]);
  };

  useSnapshots = (resourceKeys: string[]) => {
    const normalizedResourceKeys = useMemo(
      () => normalizeResourceKeys(resourceKeys),
      [resourceKeys],
    );
    const valueList = this.useStore(
      useShallow(state => {
        return normalizedResourceKeys.map(resourceKey => {
          return state.valueMap[resourceKey];
        });
      }),
    );
    const metaList = this.useStore(
      useShallow(state => {
        return normalizedResourceKeys.map(resourceKey => {
          return state.metaMap[resourceKey];
        });
      }),
    );

    return useMemo(() => {
      return buildResourceSnapshotsFromSelectedEntries(
        normalizedResourceKeys,
        valueList,
        metaList,
      );
    }, [metaList, normalizedResourceKeys, valueList]);
  };
}
