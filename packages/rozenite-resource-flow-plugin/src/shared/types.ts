export const RESOURCE_FLOW_DEVTOOLS_PLUGIN_ID =
  '@rabby-wallet/rozenite-resource-flow-plugin';

export type ResourceFlowLocalTarget =
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

export type ResourceFlowErrorPhase = 'hydrate' | 'remote' | 'persist';

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
  localTargets: ResourceFlowLocalTarget[];
  detail?: Record<string, unknown>;
  error?: ResourceFlowErrorPayload;
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
    localTargets: ResourceFlowLocalTarget[];
    activeRemoteRequestId?: string;
    lastHydratedAt?: number;
    lastRemoteAt?: number;
    lastPersistAt?: number;
    lastError?: {
      phase: ResourceFlowErrorPhase;
      message: string;
    };
  };
};

export type ResourceFlowSnapshotPayload = {
  entries: ResourceFlowTraceEntry[];
  resources: ResourceFlowResourceSnapshot[];
};

export type ResourceFlowDevToolsEventMap = {
  'resource-flow-request-snapshot': Record<string, never>;
  'resource-flow-snapshot': ResourceFlowSnapshotPayload;
  'resource-flow-trace-added': {
    entry: ResourceFlowTraceEntry;
  };
  'resource-flow-resource-upserted': {
    resource: ResourceFlowResourceSnapshot;
  };
  'resource-flow-resource-removed': {
    resourceId: string;
  };
  'resource-flow-traces-cleared': Record<string, never>;
};
