import { themeColorsNext2024 } from '@rabby-wallet/base-utils/src/isomorphic/theme-colors';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import React, { useEffect, useMemo, useState } from 'react';
import {
  RESOURCE_FLOW_DEVTOOLS_PLUGIN_ID,
  type ResourceFlowDevToolsEventMap,
  type ResourceFlowResourceSnapshot,
  type ResourceFlowTraceEntry,
} from '../shared/types';
import './globals.css';

const darkTheme = themeColorsNext2024.dark;

const panelThemeStyle = {
  '--rf-brand': darkTheme['brand-default'],
  '--rf-brand-soft': darkTheme['brand-light-2'],
  '--rf-bg': darkTheme['neutral-bg-0'],
  '--rf-bg-panel': darkTheme['neutral-bg-1'],
  '--rf-bg-subtle': darkTheme['neutral-bg-2'],
  '--rf-bg-elevated': darkTheme['neutral-bg-3'],
  '--rf-line': darkTheme['neutral-line'],
  '--rf-title': darkTheme['neutral-title-1'],
  '--rf-body': darkTheme['neutral-body'],
  '--rf-foot': darkTheme['neutral-foot'],
  '--rf-green': darkTheme['green-default'],
  '--rf-orange': darkTheme['orange-default'],
  '--rf-red': darkTheme['red-default'],
  '--rf-blue': darkTheme['blue-default'],
} as React.CSSProperties;

function formatTimestamp(value?: number) {
  if (!value) {
    return 'n/a';
  }

  return new Date(value).toLocaleString();
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function getStatusClassName(status?: string) {
  if (!status) {
    return '';
  }
  if (
    status === 'success' ||
    status === 'hydrate_applied' ||
    status === 'remote_fetch_succeeded' ||
    status === 'persist_succeeded'
  ) {
    return 'is-good';
  }
  if (
    status === 'error' ||
    status === 'hydrate_failed' ||
    status === 'remote_fetch_failed' ||
    status === 'persist_failed'
  ) {
    return 'is-bad';
  }
  if (
    status === 'queued' ||
    status === 'persisting' ||
    status === 'hydrate_started' ||
    status === 'remote_fetch_started' ||
    status === 'persist_enqueued'
  ) {
    return 'is-warn';
  }

  return '';
}

function getResourceUpdatedAt(resource: ResourceFlowResourceSnapshot) {
  const meta = resource.meta;
  return Math.max(
    meta.lastHydratedAt || 0,
    meta.lastRemoteAt || 0,
    meta.lastPersistAt || 0,
  );
}

function JsonSection(props: { title: string; value: unknown }) {
  return (
    <section className="rf-card rf-card-full">
      <div className="rf-card-header">{props.title}</div>
      <div className="rf-card-body">
        <pre>{toJson(props.value)}</pre>
      </div>
    </section>
  );
}

export default function ResourceFlowPanel() {
  const [entries, setEntries] = useState<ResourceFlowTraceEntry[]>([]);
  const [resources, setResources] = useState<ResourceFlowResourceSnapshot[]>([]);
  const [filterText, setFilterText] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  );

  const client = useRozeniteDevToolsClient<ResourceFlowDevToolsEventMap>({
    pluginId: RESOURCE_FLOW_DEVTOOLS_PLUGIN_ID,
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const requestSnapshot = () => {
      client.send('resource-flow-request-snapshot', {});
    };

    requestSnapshot();

    const snapshotSub = client.onMessage('resource-flow-snapshot', payload => {
      setEntries(payload.entries);
      setResources(payload.resources);
    });
    const traceSub = client.onMessage('resource-flow-trace-added', payload => {
      setEntries(previous => [...previous, payload.entry].slice(-300));
    });
    const resourceSub = client.onMessage(
      'resource-flow-resource-upserted',
      payload => {
        setResources(previous => {
          const next = previous.filter(item => item.id !== payload.resource.id);
          next.push(payload.resource);
          return next;
        });
      },
    );
    const clearSub = client.onMessage('resource-flow-traces-cleared', () => {
      setEntries([]);
      setResources([]);
      setSelectedResourceId(null);
    });

    return () => {
      snapshotSub.remove();
      traceSub.remove();
      resourceSub.remove();
      clearSub.remove();
    };
  }, [client]);

  const filteredResources = useMemo(() => {
    const keyword = filterText.trim().toLowerCase();
    const sorted = [...resources].sort(
      (left, right) => getResourceUpdatedAt(right) - getResourceUpdatedAt(left),
    );

    if (!keyword) {
      return sorted;
    }

    return sorted.filter(resource => {
      return [
        resource.family,
        resource.resourceKey,
        JSON.stringify(resource.meta.localTargets || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [filterText, resources]);

  useEffect(() => {
    if (!filteredResources.length) {
      setSelectedResourceId(null);
      return;
    }

    if (
      selectedResourceId &&
      filteredResources.some(item => item.id === selectedResourceId)
    ) {
      return;
    }

    setSelectedResourceId(filteredResources[0].id);
  }, [filteredResources, selectedResourceId]);

  const selectedResource = useMemo(
    () =>
      filteredResources.find(resource => resource.id === selectedResourceId) ||
      null,
    [filteredResources, selectedResourceId],
  );

  const selectedTraces = useMemo(() => {
    if (!selectedResource) {
      return [];
    }

    return entries
      .filter(
        entry =>
          entry.family === selectedResource.family &&
          entry.resourceKey === selectedResource.resourceKey,
      )
      .sort((left, right) => right.at - left.at)
      .slice(0, 60);
  }, [entries, selectedResource]);

  return (
    <div className="rf-panel" style={panelThemeStyle}>
      <aside className="rf-sidebar">
        <div className="rf-section-head">
          <div className="rf-title-block">
            <h1>Resource Flow</h1>
            <p>
              Inspect remote to memory to persist lifecycle for tracked
              resources.
            </p>
          </div>
          <div className="rf-toolbar">
            <input
              value={filterText}
              onChange={event => setFilterText(event.target.value)}
              placeholder="Filter by family, key or target..."
            />
            <button
              type="button"
              onClick={() =>
                client?.send('resource-flow-request-snapshot', {})
              }>
              Refresh
            </button>
          </div>
        </div>
        <div className="rf-sidebar-scroll">
          {!filteredResources.length ? (
            <div className="rf-empty">
              <div>No tracked resources yet.</div>
              <div className="rf-empty-sub">
                Trigger the `balance24h` flow in app, then refresh this panel.
              </div>
            </div>
          ) : (
            filteredResources.map(resource => {
              const isActive = resource.id === selectedResourceId;
              return (
                <button
                  key={resource.id}
                  type="button"
                  className={`rf-resource-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedResourceId(resource.id)}>
                  <div className="rf-resource-head">
                    <span className="rf-pill rf-pill-brand">
                      {resource.family}
                    </span>
                    <span className="rf-pill">v{resource.meta.version}</span>
                  </div>
                  <div className="rf-resource-key">{resource.resourceKey}</div>
                  <div className="rf-resource-meta">
                    source={resource.meta.sourceOfCurrentValue || 'n/a'} ·
                    persist={resource.meta.persistStatus} · updated=
                    {formatTimestamp(getResourceUpdatedAt(resource))}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="rf-main">
        <div className="rf-section-head">
          <div className="rf-title-block">
            <h2>
              {selectedResource
                ? `${selectedResource.family} / ${selectedResource.resourceKey}`
                : 'No resource selected'}
            </h2>
            <p>
              {selectedResource
                ? `${selectedTraces.length} recent trace(s) for current resource`
                : 'Select a resource from the list to inspect details.'}
            </p>
          </div>
        </div>

        <div className="rf-main-scroll">
          {!selectedResource ? (
            <div className="rf-empty">
              <div>No resource selected.</div>
              <div className="rf-empty-sub">
                This panel currently observes the `balance24h` pilot flow.
              </div>
            </div>
          ) : (
            <div className="rf-cards">
              <section className="rf-card">
                <div className="rf-card-header">Current Meta</div>
                <div className="rf-card-body">
                  <div className="rf-kv">
                    <div className="rf-kv-key">Has Value</div>
                    <div className="rf-kv-value">
                      {String(selectedResource.meta.hasValue)}
                    </div>
                    <div className="rf-kv-key">Source</div>
                    <div className="rf-kv-value">
                      {selectedResource.meta.sourceOfCurrentValue || 'n/a'}
                    </div>
                    <div className="rf-kv-key">Version</div>
                    <div className="rf-kv-value">
                      {selectedResource.meta.version}
                    </div>
                    <div className="rf-kv-key">Hydrating</div>
                    <div className="rf-kv-value">
                      {String(selectedResource.meta.isHydrating)}
                    </div>
                    <div className="rf-kv-key">Fetching Remote</div>
                    <div className="rf-kv-value">
                      {String(selectedResource.meta.isFetchingRemote)}
                    </div>
                    <div className="rf-kv-key">Persist Status</div>
                    <div
                      className={`rf-kv-value ${getStatusClassName(
                        selectedResource.meta.persistStatus,
                      )}`}>
                      {selectedResource.meta.persistStatus}
                    </div>
                    <div className="rf-kv-key">Active Request</div>
                    <div className="rf-kv-value">
                      {selectedResource.meta.activeRemoteRequestId || 'n/a'}
                    </div>
                    <div className="rf-kv-key">Last Hydrated</div>
                    <div className="rf-kv-value">
                      {formatTimestamp(selectedResource.meta.lastHydratedAt)}
                    </div>
                    <div className="rf-kv-key">Last Remote</div>
                    <div className="rf-kv-value">
                      {formatTimestamp(selectedResource.meta.lastRemoteAt)}
                    </div>
                    <div className="rf-kv-key">Last Persist</div>
                    <div className="rf-kv-value">
                      {formatTimestamp(selectedResource.meta.lastPersistAt)}
                    </div>
                  </div>
                </div>
              </section>

              <JsonSection
                title="Last Error"
                value={selectedResource.meta.lastError}
              />
              <JsonSection
                title="Current Memory Value"
                value={selectedResource.value}
              />
              <JsonSection
                title="Local Targets"
                value={selectedResource.meta.localTargets}
              />

              <section className="rf-card rf-card-full">
                <div className="rf-card-header">Recent Trace Timeline</div>
                <div className="rf-card-body">
                  <div className="rf-trace-list">
                    {!selectedTraces.length ? (
                      <div className="rf-empty rf-empty-compact">
                        <div>No trace yet for this resource.</div>
                      </div>
                    ) : (
                      selectedTraces.map(trace => (
                        <article key={trace.id} className="rf-trace-item">
                          <div className="rf-trace-head">
                            <div
                              className={`rf-trace-type ${getStatusClassName(
                                trace.type,
                              )}`}>
                              {trace.type}
                            </div>
                            <div className="rf-trace-time">
                              {formatTimestamp(trace.at)}
                            </div>
                          </div>
                          <div className="rf-trace-request">
                            request={trace.requestId || 'n/a'}
                          </div>
                          <pre>
                            {toJson({
                              detail: trace.detail || null,
                              localTargets: trace.localTargets || [],
                              error: trace.error || null,
                            })}
                          </pre>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
