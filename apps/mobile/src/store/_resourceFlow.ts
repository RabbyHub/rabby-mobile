import { BaseStore, BaseStoreOptions } from './_base';
import {
  buildResourceFlowResourceId,
  removeResourceFlowResourceSnapshot,
  recordResourceFlowTrace,
  ResourceLocalTarget,
  serializeResourceFlowError,
  upsertResourceFlowResourceSnapshot,
} from './_resourceFlowDebug';

export type ObservableResourceValueSource = 'hydrate' | 'remote';
export type ObservableResourcePersistStatus =
  | 'idle'
  | 'queued'
  | 'persisting'
  | 'success'
  | 'error';
export type ObservableResourceErrorPhase = 'hydrate' | 'remote' | 'persist';

export type ObservableResourceErrorState = {
  phase: ObservableResourceErrorPhase;
  message: string;
};

export type ObservableResourceMeta = {
  family: string;
  resourceKey: string;
  hasValue: boolean;
  version: number;
  sourceOfCurrentValue?: ObservableResourceValueSource;
  isHydrating: boolean;
  isFetchingRemote: boolean;
  persistStatus: ObservableResourcePersistStatus;
  localTargets: ResourceLocalTarget[];
  activeRemoteRequestId?: string;
  lastHydratedAt?: number;
  lastRemoteAt?: number;
  lastPersistAt?: number;
  lastError?: ObservableResourceErrorState;
};

export type ObservableResourceState<TValue> = {
  valueMap: Record<string, TValue>;
  metaMap: Record<string, ObservableResourceMeta>;
};

type ResourceLifecycleOptions = {
  requestId?: string;
  localTargets?: ResourceLocalTarget[];
  detail?: Record<string, unknown>;
};

function createDefaultMeta(
  family: string,
  resourceKey: string,
  localTargets: ResourceLocalTarget[] = [],
): ObservableResourceMeta {
  return {
    family,
    resourceKey,
    hasValue: false,
    version: 0,
    isHydrating: false,
    isFetchingRemote: false,
    persistStatus: 'idle',
    localTargets,
  };
}

function mergeLocalTargets(
  prevTargets: ResourceLocalTarget[],
  nextTargets?: ResourceLocalTarget[],
) {
  if (!nextTargets?.length) {
    return prevTargets;
  }

  const merged = [...prevTargets];
  nextTargets.forEach(target => {
    const serializedTarget = JSON.stringify(target);
    if (!merged.some(item => JSON.stringify(item) === serializedTarget)) {
      merged.push(target);
    }
  });

  return merged;
}

export class ObservableResourceStore<TValue> extends BaseStore<
  ObservableResourceState<TValue>
> {
  private requestSequence = 0;

  constructor(private readonly family: string, options?: BaseStoreOptions) {
    super(
      {
        valueMap: {},
        metaMap: {},
      },
      options,
    );
  }

  private syncDebugSnapshot(resourceKey: string) {
    const state = this.getState();
    const meta = state.metaMap[resourceKey];

    if (!meta) {
      return;
    }

    upsertResourceFlowResourceSnapshot({
      id: buildResourceFlowResourceId(this.family, resourceKey),
      family: this.family,
      resourceKey,
      value: state.valueMap[resourceKey],
      meta: {
        hasValue: meta.hasValue,
        version: meta.version,
        sourceOfCurrentValue: meta.sourceOfCurrentValue,
        isHydrating: meta.isHydrating,
        isFetchingRemote: meta.isFetchingRemote,
        persistStatus: meta.persistStatus,
        localTargets: meta.localTargets,
        activeRemoteRequestId: meta.activeRemoteRequestId,
        lastHydratedAt: meta.lastHydratedAt,
        lastRemoteAt: meta.lastRemoteAt,
        lastPersistAt: meta.lastPersistAt,
        lastError: meta.lastError,
      },
    });
  }

  getValueMap = () => this.getState().valueMap;

  getMetaMap = () => this.getState().metaMap;

  getValue = (resourceKey: string | undefined) => {
    if (!resourceKey) {
      return undefined;
    }

    return this.getState().valueMap[resourceKey];
  };

  getMeta = (resourceKey: string | undefined) => {
    if (!resourceKey) {
      return undefined;
    }

    return this.getState().metaMap[resourceKey];
  };

  useValue = (resourceKey?: string) =>
    this.useStore(s => {
      if (!resourceKey) {
        return undefined;
      }
      return s.valueMap[resourceKey];
    });

  useMeta = (resourceKey?: string) =>
    this.useStore(s => {
      if (!resourceKey) {
        return undefined;
      }
      return s.metaMap[resourceKey];
    });

  markHydrateStarted = (
    resourceKey: string,
    options?: ResourceLifecycleOptions,
  ) => {
    const localTargets = options?.localTargets || [];

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
        isHydrating: true,
        lastError:
          prevMeta.lastError?.phase === 'hydrate'
            ? undefined
            : prevMeta.lastError,
      };

      return {
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'hydrate_started',
      requestId: options?.requestId,
      localTargets,
      detail: options?.detail,
    });
  };

  markHydrateSkipped = (
    resourceKey: string,
    options?: ResourceLifecycleOptions,
  ) => {
    const localTargets = options?.localTargets || [];

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
        isHydrating: false,
      };

      return {
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'hydrate_skipped',
      requestId: options?.requestId,
      localTargets,
      detail: options?.detail,
    });
  };

  applyHydratedValue = (
    resourceKey: string,
    value: TValue,
    options?: ResourceLifecycleOptions,
  ) => {
    const localTargets = options?.localTargets || [];
    const now = Date.now();

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        hasValue: true,
        version: prevMeta.version + 1,
        sourceOfCurrentValue: 'hydrate',
        isHydrating: false,
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
        lastHydratedAt: now,
        lastError:
          prevMeta.lastError?.phase === 'hydrate'
            ? undefined
            : prevMeta.lastError,
      };

      return {
        valueMap: {
          ...prev.valueMap,
          [resourceKey]: value,
        },
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'hydrate_applied',
      requestId: options?.requestId,
      localTargets,
      detail: options?.detail,
    });
  };

  startRemoteFetch = (
    resourceKey: string,
    options?: Omit<ResourceLifecycleOptions, 'requestId'>,
  ) => {
    const requestId = `${this.family}:${resourceKey}:remote:${++this
      .requestSequence}`;

    this.markRemoteFetchStartedWithRequestId(resourceKey, requestId, options);

    return requestId;
  };

  markRemoteFetchStartedWithRequestId = (
    resourceKey: string,
    requestId: string,
    options?: Omit<ResourceLifecycleOptions, 'requestId'>,
  ) => {
    const localTargets = options?.localTargets || [];

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        isFetchingRemote: true,
        activeRemoteRequestId: requestId,
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
        lastError:
          prevMeta.lastError?.phase === 'remote'
            ? undefined
            : prevMeta.lastError,
      };

      return {
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'remote_fetch_started',
      requestId,
      localTargets,
      detail: options?.detail,
    });
  };

  applyRemoteValue = (
    resourceKey: string,
    requestId: string,
    value: TValue,
    options?: Omit<ResourceLifecycleOptions, 'requestId'>,
  ) => {
    const localTargets = options?.localTargets || [];
    const currentMeta = this.getMeta(resourceKey);

    if (
      currentMeta?.activeRemoteRequestId &&
      currentMeta.activeRemoteRequestId !== requestId
    ) {
      recordResourceFlowTrace({
        family: this.family,
        resourceKey,
        type: 'remote_fetch_ignored_stale',
        requestId,
        localTargets: mergeLocalTargets(currentMeta.localTargets, localTargets),
        detail: options?.detail,
      });
      return false;
    }

    const now = Date.now();

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        hasValue: true,
        version: prevMeta.version + 1,
        sourceOfCurrentValue: 'remote',
        isFetchingRemote: false,
        activeRemoteRequestId: undefined,
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
        lastRemoteAt: now,
        lastError:
          prevMeta.lastError?.phase === 'remote'
            ? undefined
            : prevMeta.lastError,
      };

      return {
        valueMap: {
          ...prev.valueMap,
          [resourceKey]: value,
        },
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'remote_fetch_succeeded',
      requestId,
      localTargets,
      detail: options?.detail,
    });

    return true;
  };

  queuePersist = (resourceKey: string, options?: ResourceLifecycleOptions) => {
    const localTargets = options?.localTargets || [];

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        persistStatus: 'queued',
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
      };

      return {
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'persist_enqueued',
      requestId: options?.requestId,
      localTargets,
      detail: options?.detail,
    });
  };

  markPersistStarted = (
    resourceKey: string,
    options?: ResourceLifecycleOptions,
  ) => {
    const localTargets = options?.localTargets || [];

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        persistStatus: 'persisting',
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
      };

      return {
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'persist_started',
      requestId: options?.requestId,
      localTargets,
      detail: options?.detail,
    });
  };

  markPersistSucceeded = (
    resourceKey: string,
    options?: ResourceLifecycleOptions,
  ) => {
    const localTargets = options?.localTargets || [];
    const now = Date.now();

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        persistStatus: 'success',
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
        lastPersistAt: now,
        lastError:
          prevMeta.lastError?.phase === 'persist'
            ? undefined
            : prevMeta.lastError,
      };

      return {
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'persist_succeeded',
      requestId: options?.requestId,
      localTargets,
      detail: options?.detail,
    });
  };

  markError = (
    resourceKey: string,
    phase: ObservableResourceErrorPhase,
    error: unknown,
    options?: ResourceLifecycleOptions,
  ) => {
    const localTargets = options?.localTargets || [];
    const serializedError = serializeResourceFlowError(error);
    const currentMeta = this.getMeta(resourceKey);

    if (
      phase === 'remote' &&
      options?.requestId &&
      currentMeta?.activeRemoteRequestId &&
      currentMeta.activeRemoteRequestId !== options.requestId
    ) {
      recordResourceFlowTrace({
        family: this.family,
        resourceKey,
        type: 'remote_fetch_ignored_stale',
        requestId: options.requestId,
        localTargets: mergeLocalTargets(currentMeta.localTargets, localTargets),
        detail: {
          ...(options?.detail || {}),
          reason: 'stale_request_error',
        },
        error: serializedError,
      });
      return false;
    }

    this.setState(prev => {
      const prevMeta =
        prev.metaMap[resourceKey] ||
        createDefaultMeta(this.family, resourceKey, localTargets);
      const nextMeta: ObservableResourceMeta = {
        ...prevMeta,
        isHydrating: phase === 'hydrate' ? false : prevMeta.isHydrating,
        isFetchingRemote:
          phase === 'remote' ? false : prevMeta.isFetchingRemote,
        activeRemoteRequestId:
          phase === 'remote' ? undefined : prevMeta.activeRemoteRequestId,
        persistStatus: phase === 'persist' ? 'error' : prevMeta.persistStatus,
        localTargets: mergeLocalTargets(prevMeta.localTargets, localTargets),
        lastError: {
          phase,
          message: serializedError.message,
        },
      };

      return {
        metaMap: {
          ...prev.metaMap,
          [resourceKey]: nextMeta,
        },
      };
    });
    this.syncDebugSnapshot(resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type:
        phase === 'hydrate'
          ? 'hydrate_failed'
          : phase === 'remote'
          ? 'remote_fetch_failed'
          : 'persist_failed',
      requestId: options?.requestId,
      localTargets,
      detail: options?.detail,
      error: serializedError,
    });

    return true;
  };

  persistInBackground = (
    resourceKey: string,
    persist: () => Promise<void> | void,
    options?: ResourceLifecycleOptions,
  ) => {
    this.queuePersist(resourceKey, options);

    return Promise.resolve()
      .then(() => {
        this.markPersistStarted(resourceKey, options);
        return persist();
      })
      .then(() => {
        this.markPersistSucceeded(resourceKey, options);
      })
      .catch(error => {
        this.markError(resourceKey, 'persist', error, options);
      });
  };

  removeResource = (
    resourceKey: string,
    options?: ResourceLifecycleOptions,
  ) => {
    const currentState = this.getState();

    if (
      !(resourceKey in currentState.valueMap) &&
      !(resourceKey in currentState.metaMap)
    ) {
      return false;
    }

    this.setState(prev => {
      if (!(resourceKey in prev.valueMap) && !(resourceKey in prev.metaMap)) {
        return prev;
      }

      const nextValueMap = {
        ...prev.valueMap,
      };
      const nextMetaMap = {
        ...prev.metaMap,
      };

      delete nextValueMap[resourceKey];
      delete nextMetaMap[resourceKey];

      return {
        valueMap: nextValueMap,
        metaMap: nextMetaMap,
      };
    });

    removeResourceFlowResourceSnapshot(this.family, resourceKey);

    recordResourceFlowTrace({
      family: this.family,
      resourceKey,
      type: 'resource_removed',
      requestId: options?.requestId,
      localTargets: options?.localTargets || [],
      detail: options?.detail,
    });

    return true;
  };
}

export default ObservableResourceStore;
