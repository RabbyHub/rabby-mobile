import { makeJsEEClass } from '@/core/services/_utils';
import { zCreate } from '@/core/utils/reexports';

export type ResourceLocalTarget =
  | {
      kind: 'mmkv';
      file: string;
      key: string;
    }
  | {
      kind: 'sqlite';
      table: string;
      where: Record<string, string | number | boolean | null>;
    };

export type ResourceFlowTraceType =
  | 'hydrate_started'
  | 'hydrate_applied'
  | 'hydrate_skipped'
  | 'hydrate_failed'
  | 'remote_fetch_started'
  | 'remote_fetch_succeeded'
  | 'remote_fetch_failed'
  | 'remote_fetch_ignored_stale'
  | 'persist_enqueued'
  | 'persist_started'
  | 'persist_succeeded'
  | 'persist_failed'
  | 'resource_removed';

export type ResourceFlowErrorPayload = {
  name?: string;
  message: string;
  stack?: string;
};

export type ResourceFlowTraceEntry = {
  id: string;
  at: number;
  family: string;
  resourceKey: string;
  type: ResourceFlowTraceType;
  requestId?: string;
  localTargets: ResourceLocalTarget[];
  detail?: Record<string, unknown>;
  error?: ResourceFlowErrorPayload;
};

type ResourceFlowDebugState = {
  entries: ResourceFlowTraceEntry[];
  resources: Record<string, ResourceFlowResourceSnapshot>;
};

const MAX_RESOURCE_FLOW_TRACE_ENTRIES = 300;

type ResourceFlowDebugEventBusListeners = {
  RESOURCE_FLOW_TRACE_ADDED: (entry: ResourceFlowTraceEntry) => void;
  RESOURCE_FLOW_TRACE_CLEARED: () => void;
  RESOURCE_FLOW_RESOURCE_UPSERTED: (
    resource: ResourceFlowResourceSnapshot,
  ) => void;
  RESOURCE_FLOW_RESOURCE_REMOVED: (resourceId: string) => void;
};

export type ResourceFlowResourceSnapshot = {
  id: string;
  family: string;
  resourceKey: string;
  value?: unknown;
  meta: {
    hasValue: boolean;
    version: number;
    sourceOfCurrentValue?: 'hydrate' | 'remote';
    isHydrating: boolean;
    isFetchingRemote: boolean;
    persistStatus: 'idle' | 'queued' | 'persisting' | 'success' | 'error';
    localTargets: ResourceLocalTarget[];
    activeRemoteRequestId?: string;
    lastHydratedAt?: number;
    lastRemoteAt?: number;
    lastPersistAt?: number;
    lastError?: {
      phase: 'hydrate' | 'remote' | 'persist';
      message: string;
    };
  };
};

const { EventEmitter: ResourceFlowDebugEE } =
  makeJsEEClass<ResourceFlowDebugEventBusListeners>();

const resourceFlowDebugStore = zCreate<ResourceFlowDebugState>(() => ({
  entries: [],
  resources: {},
}));

export const resourceFlowDebugEvents = new ResourceFlowDebugEE();

export const RESOURCE_FLOW_TRACE_ADDED = 'RESOURCE_FLOW_TRACE_ADDED';
export const RESOURCE_FLOW_TRACE_CLEARED = 'RESOURCE_FLOW_TRACE_CLEARED';
export const RESOURCE_FLOW_RESOURCE_UPSERTED =
  'RESOURCE_FLOW_RESOURCE_UPSERTED';
export const RESOURCE_FLOW_RESOURCE_REMOVED = 'RESOURCE_FLOW_RESOURCE_REMOVED';

export const buildResourceFlowResourceId = (
  family: string,
  resourceKey: string,
) => `${family}:${resourceKey}`;

export const serializeResourceFlowError = (
  error: unknown,
): ResourceFlowErrorPayload => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
    };
  }

  return {
    message: 'Unknown error',
  };
};

export const recordResourceFlowTrace = (
  input: Omit<ResourceFlowTraceEntry, 'id' | 'at'> &
    Partial<Pick<ResourceFlowTraceEntry, 'id' | 'at'>>,
) => {
  const entry: ResourceFlowTraceEntry = {
    ...input,
    id:
      input.id ||
      [
        input.family,
        input.resourceKey,
        input.type,
        input.requestId || 'no-request',
        Date.now(),
        Math.random().toString(36).slice(2, 8),
      ].join(':'),
    at: input.at || Date.now(),
  };

  resourceFlowDebugStore.setState(prev => ({
    ...prev,
    entries: [...prev.entries, entry].slice(-MAX_RESOURCE_FLOW_TRACE_ENTRIES),
  }));
  resourceFlowDebugEvents.emit(RESOURCE_FLOW_TRACE_ADDED, entry);

  return entry;
};

export const clearResourceFlowTraces = () => {
  resourceFlowDebugStore.setState(() => ({
    entries: [],
    resources: {},
  }));
  resourceFlowDebugEvents.emit(RESOURCE_FLOW_TRACE_CLEARED);
};

export const upsertResourceFlowResourceSnapshot = (
  resource: Omit<ResourceFlowResourceSnapshot, 'id'> &
    Partial<Pick<ResourceFlowResourceSnapshot, 'id'>>,
) => {
  const nextResource: ResourceFlowResourceSnapshot = {
    ...resource,
    id:
      resource.id ||
      buildResourceFlowResourceId(resource.family, resource.resourceKey),
  };

  resourceFlowDebugStore.setState(prev => ({
    ...prev,
    resources: {
      ...prev.resources,
      [nextResource.id]: nextResource,
    },
  }));
  resourceFlowDebugEvents.emit(RESOURCE_FLOW_RESOURCE_UPSERTED, nextResource);

  return nextResource;
};

export const removeResourceFlowResourceSnapshot = (
  family: string,
  resourceKey: string,
) => {
  const resourceId = buildResourceFlowResourceId(family, resourceKey);

  resourceFlowDebugStore.setState(prev => {
    if (!prev.resources[resourceId]) {
      return prev;
    }

    const nextResources = {
      ...prev.resources,
    };
    delete nextResources[resourceId];

    return {
      ...prev,
      resources: nextResources,
    };
  });
  resourceFlowDebugEvents.emit(RESOURCE_FLOW_RESOURCE_REMOVED, resourceId);

  return resourceId;
};

export const getResourceFlowTraceEntries = () =>
  resourceFlowDebugStore.getState().entries;

export const getResourceFlowResourceSnapshots = () =>
  resourceFlowDebugStore.getState().resources;

export const useResourceFlowTraceEntries = () =>
  resourceFlowDebugStore(s => s.entries);

export const useResourceFlowResourceSnapshots = () =>
  resourceFlowDebugStore(s => s.resources);

export default resourceFlowDebugStore;
